import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  tableNumber:   z.string().min(1),
  customerName:  z.string().min(1).max(80),
  customerPhone: z.string().max(20).optional(),
  notes:         z.string().max(300).optional(),
  items: z.array(z.object({
    menuItemId:   z.string().min(1),
    quantity:     z.number().int().positive(),
    notes:        z.string().max(200).optional(),
  })).min(1),
});

export async function POST(req: NextRequest) {
  return safeHandler("qr/order/POST", async () => {
    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { tableNumber, customerName, customerPhone, notes, items } = parsed.data;

    // Verify table exists
    const table = await prisma.restaurantTable.findFirst({ where: { number: tableNumber } });
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Server-side price lookup
    const ids      = items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: ids }, isAvailable: true },
      include: { category: { select: { name: true } } },
    });

    if (menuItems.length !== ids.length) {
      return NextResponse.json({ error: "Some items are unavailable" }, { status: 400 });
    }

    const priceMap = new Map(menuItems.map((m) => [m.id, m]));

    const enrichedItems = items.map((i) => {
      const m = priceMap.get(i.menuItemId)!;
      return {
        menuItemId:   i.menuItemId,
        name:         m.name,
        price:        m.price,
        isVeg:        m.isVeg,
        categoryName: (m.category as { name: string }).name,
        quantity:     i.quantity,
        notes:        i.notes ?? null,
        taxRate:      m.taxRate,
      };
    });

    const qrOrder = await prisma.qrOrder.create({
      data: {
        tableNumber,
        customerName,
        customerPhone: customerPhone ?? null,
        notes:         notes ?? null,
        items:         enrichedItems as never,
      },
    });

    // Notify waiters
    await prisma.notification.create({
      data: {
        type:    "QR_ORDER",
        title:   `📱 QR Order — Table ${tableNumber}`,
        message: `${customerName} placed ${items.length} item(s) via QR. Tap to approve.`,
        role:    "CASHIER",
      },
    });

    return NextResponse.json({ id: qrOrder.id }, { status: 201 });
  });
}
