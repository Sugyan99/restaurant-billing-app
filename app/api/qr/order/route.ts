import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const schema = z.object({
  tableNumber:   z.string().min(1),
  customerName:  z.string().min(1).max(80),
  customerPhone: z.string().min(10, "Phone number is required").max(20),
  notes:         z.string().max(300).optional(),
  tenantId:      z.string().uuid().optional(),
  items: z.array(z.object({
    menuItemId:   z.string().min(1),
    quantity:     z.number().int().positive(),
    notes:        z.string().max(200).optional(),
  })).min(1),
});

export async function POST(req: NextRequest) {
  return safeHandler("qr/order/POST", async () => {
    if (!checkRateLimit(getClientIp(req), 10, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please wait before placing another order." }, { status: 429 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const { tableNumber, customerName, customerPhone, notes, items, tenantId: bodyTid } = parsed.data;

    // Resolve tenant — prefer body param, fallback to single tenant
    const tenant = bodyTid
      ? await prisma.tenant.findUnique({ where: { id: bodyTid } })
      : await prisma.tenant.findFirst();
    if (!tenant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

    const tid = tenant.id;

    const table = await prisma.restaurantTable.findFirst({ where: { tenantId: tid, number: tableNumber } });
    if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

    const ids = items.map(i => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { tenantId: tid, id: { in: ids }, isAvailable: true },
      include: { category: { select: { name: true } } },
    });

    if (menuItems.length !== ids.length) {
      return NextResponse.json({ error: "Some items are unavailable" }, { status: 400 });
    }

    const priceMap = new Map(menuItems.map(m => [m.id, m]));
    const enrichedItems = items.map(i => {
      const m = priceMap.get(i.menuItemId)!;
      return {
        menuItemId: i.menuItemId, name: m.name, price: m.price,
        isVeg: m.isVeg, categoryName: (m.category as { name: string }).name,
        quantity: i.quantity, notes: i.notes ?? null, taxRate: m.taxRate,
      };
    });

    const qrOrder = await prisma.qrOrder.create({
      data: { tenantId: tid, tableNumber, customerName, customerPhone, notes: notes ?? null, items: enrichedItems as never },
    });

    // Notify tenant's staff
    await prisma.notification.create({
      data: {
        id: `notif_${Date.now()}`,
        tenantId: tid,
        type: "QR_ORDER",
        title: `📱 QR Order — Table ${tableNumber}`,
        message: `${customerName} placed ${items.length} item(s) via QR. Tap to approve.`,
        role: "CASHIER",
      },
    });

    return NextResponse.json({ id: qrOrder.id }, { status: 201 });
  });
}
