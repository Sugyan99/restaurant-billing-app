import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { fireItemsInTx } from "@/lib/kotEngine";

type QrItem = {
  menuItemId: string; name: string; price: number; isVeg: boolean;
  categoryName: string; quantity: number; notes: string | null; taxRate: number | null;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("qr/approve/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;

    return withTenant(session.tenantId, session.userId, async (tx) => {
      const qrOrder = await tx.qrOrder.findFirst({
        where: { id, tenantId: session.tenantId },
      });
      if (!qrOrder) return NextResponse.json({ error: "QR order not found" }, { status: 404 });
      if (qrOrder.status !== "PENDING") return NextResponse.json({ error: "Order already processed" }, { status: 409 });

      const items = qrOrder.items as QrItem[];

      // Find the table (scoped to tenant)
      const table = await tx.restaurantTable.findFirst({
        where: { tenantId: session.tenantId, number: qrOrder.tableNumber },
      });

      // Verify menu items still available
      const menuItemIds = [...new Set(items.map(i => i.menuItemId))];
      const dbItems = await tx.menuItem.findMany({
        where: { tenantId: session.tenantId, id: { in: menuItemIds }, isAvailable: true },
        select: { id: true, price: true, taxRate: true },
      });
      if (dbItems.length !== menuItemIds.length) {
        return NextResponse.json({ error: "Some items are no longer available" }, { status: 400 });
      }
      const priceMap = new Map(dbItems.map(m => [m.id, m]));

      // Create order
      const orderNumber = Math.floor(100 + Math.random() * 900);
      const order = await tx.order.create({
        data: {
          id: `ord_${Date.now()}`,
          tenantId: session.tenantId,
          orderNumber,
          type: "DINE_IN",
          status: "PENDING",
          tableId: table?.id ?? null,
          customerName: qrOrder.customerName,
          customerPhone: qrOrder.customerPhone ?? null,
          kotNote: qrOrder.notes ?? null,
          createdById: session.userId,
          items: {
            create: items.map(i => {
              const db = priceMap.get(i.menuItemId)!;
              return {
                id: `oi_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                tenantId: session.tenantId,
                menuItemId: i.menuItemId,
                quantity: i.quantity,
                price: db.price,
                notes: i.notes ?? null,
                kitchen: "MAIN",
              };
            }),
          },
        },
        include: { items: true },
      });

      if (table) {
        await tx.restaurantTable.update({ where: { id: table.id }, data: { status: "OCCUPIED" } });
      }

      // Fire KOT
      await fireItemsInTx(
        tx as unknown as Parameters<typeof fireItemsInTx>[0],
        order.id, "MAIN",
        order.items.map(i => ({ orderItemId: i.id, quantity: i.quantity }))
      );

      // Mark QR order approved + link order
      await tx.qrOrder.update({ where: { id }, data: { status: "APPROVED", orderId: order.id } });

      return NextResponse.json({ success: true, orderId: order.id });
    });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("qr/approve/DELETE", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;

    const qrOrder = await withTenant(session.tenantId, session.userId, async (tx) => {
      const o = await tx.qrOrder.findFirst({ where: { id, tenantId: session.tenantId } });
      if (!o) return null;
      return tx.qrOrder.update({ where: { id }, data: { status: "REJECTED" } });
    });
    if (!qrOrder) return NextResponse.json({ error: "QR order not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  });
}
