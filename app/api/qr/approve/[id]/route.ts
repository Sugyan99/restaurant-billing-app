import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { fireItemsInTx } from "@/lib/kotEngine";
import type { Prisma } from "@prisma/client";

type QrItem = {
  menuItemId: string;
  name: string;
  price: number;
  isVeg: boolean;
  categoryName: string;
  quantity: number;
  notes: string | null;
  taxRate: number | null;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("qr/approve/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;

    const { id } = await params;

    const qrOrder = await prisma.qrOrder.findUnique({ where: { id } });
    if (!qrOrder) return NextResponse.json({ error: "QR order not found" }, { status: 404 });
    if (qrOrder.status !== "PENDING") {
      return NextResponse.json({ error: "Order already processed" }, { status: 409 });
    }

    const items = qrOrder.items as QrItem[];

    // Find the table
    const table = await prisma.restaurantTable.findFirst({
      where: { number: qrOrder.tableNumber },
    });
    if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

    // Verify all menu items still exist and are available
    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, price: true, taxRate: true, isAvailable: true, name: true },
    });
    const unavailable = menuItems.filter((m) => !m.isAvailable);
    if (unavailable.length > 0) {
      return NextResponse.json(
        { error: `Unavailable: ${unavailable.map((m) => m.name).join(", ")}` },
        { status: 400 }
      );
    }
    const priceMap = new Map(menuItems.map((m) => [m.id, m]));

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create real order
      const order = await tx.order.create({
        data: {
          type:          "DINE_IN",
          tableId:       table.id,
          customerName:  qrOrder.customerName,
          customerPhone: qrOrder.customerPhone ?? null,
          kotNote:       qrOrder.notes ?? null,
          createdById:   session.userId,
          source:        "QR",
          items: {
            create: items.map((i) => ({
              menuItemId: i.menuItemId,
              quantity:   i.quantity,
              notes:      i.notes ?? null,
              price:      priceMap.get(i.menuItemId)?.price ?? i.price,
              taxRate:    priceMap.get(i.menuItemId)?.taxRate ?? i.taxRate,
            })),
          },
        },
        include: { items: true },
      });

      // Mark table occupied
      await tx.restaurantTable.update({
        where: { id: table.id },
        data:  { status: "OCCUPIED" },
      });

      // Fire KOT — group all items under MAIN station (QR orders go to main kitchen)
      const firePlan = order.items.map((oi) => ({ orderItemId: oi.id, qty: oi.quantity }));
      await fireItemsInTx(
        tx as unknown as Parameters<typeof fireItemsInTx>[0],
        order.id,
        "MAIN",
        firePlan
      );

      // Update QrOrder → APPROVED
      await tx.qrOrder.update({
        where: { id },
        data:  { status: "APPROVED", orderId: order.id },
      });

      // Kitchen notification
      await tx.notification.create({
        data: {
          type:    "NEW_KOT",
          title:   `New KOT #${order.orderNumber} (QR — Table ${qrOrder.tableNumber})`,
          message: `${qrOrder.customerName} · ${items.length} item(s)`,
          role:    "KITCHEN",
        },
      });

      return order;
    });

    return NextResponse.json({ orderId: result.id, orderNumber: result.orderNumber });
  });
}
