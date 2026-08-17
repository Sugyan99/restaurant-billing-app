import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const schema = z.object({
  tableNumber:   z.string().min(1),
  customerName:  z.string().trim().min(1).max(80),
  customerPhone: z.string().trim().min(10, "Phone number is required").max(20),
  notes:         z.string().trim().max(300).optional(),
  // Kept optional for backward compatibility. The server derives the tenant
  // from the submitted menu item when it is not supplied by the client.
  tenantId:      z.string().uuid().optional(),
  items: z.array(z.object({
    menuItemId:   z.string().min(1),
    quantity:     z.number().int().positive().max(99),
    notes:        z.string().trim().max(200).optional(),
  })).min(1).max(100),
});

export async function POST(req: NextRequest) {
  return safeHandler("qr/order/POST", async () => {
    if (!checkRateLimit(getClientIp(req), 10, 60_000)) {
      return NextResponse.json({ error: "Too many requests. Please wait before placing another order." }, { status: 429 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const { tableNumber, customerName, customerPhone, notes, items, tenantId: bodyTid } = parsed.data;
    const ids = [...new Set(items.map(i => i.menuItemId))];

    // Do not trust a public client to select an arbitrary tenant. Menu item IDs
    // are globally unique, so derive the tenant from the first submitted item
    // and then require every item/table to belong to that same tenant.
    const anchor = await prisma.menuItem.findUnique({
      where: { id: ids[0] },
      select: { tenantId: true },
    });
    if (!anchor) return NextResponse.json({ error: "Some items are unavailable" }, { status: 400 });

    const tid = anchor.tenantId;
    if (bodyTid && bodyTid !== tid) {
      return NextResponse.json({ error: "Invalid restaurant context" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tid },
      select: { id: true },
    });
    if (!tenant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

    const table = await prisma.restaurantTable.findFirst({
      where: { tenantId: tid, number: tableNumber },
    });
    if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

    const menuItems = await prisma.menuItem.findMany({
      where: { tenantId: tid, id: { in: ids }, isAvailable: true },
      include: { category: { select: { name: true } } },
    });

    if (menuItems.length !== ids.length) {
      return NextResponse.json({ error: "Some items are unavailable" }, { status: 400 });
    }

    const priceMap = new Map(menuItems.map(m => [m.id, m]));
    const enrichedItems = items.map(i => {
      const m = priceMap.get(i.menuItemId);
      if (!m) throw new Error("Menu item validation failed");
      return {
        menuItemId: i.menuItemId,
        name: m.name,
        price: m.price,
        isVeg: m.isVeg,
        categoryName: (m.category as { name: string }).name,
        quantity: i.quantity,
        notes: i.notes ?? null,
        taxRate: m.taxRate,
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
