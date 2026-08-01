import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

// POST /api/orders/[id]/split — move selected items to a new KOT
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("orders/[id]/split/POST", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const { id } = await params;
    const { itemIds } = await req.json() as { itemIds: string[] };

    if (!itemIds?.length) {
      return NextResponse.json({ error: "Select at least one item to split" }, { status: 400 });
    }

    const original = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!original) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const remainingItems = original.items.filter((i: { id: string }) => !itemIds.includes(i.id));
    if (remainingItems.length === 0) {
      return NextResponse.json({ error: "Cannot move all items — original KOT would be empty" }, { status: 400 });
    }

    const newOrder = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create new order with same context
      const created = await tx.order.create({
        data: {
          type: original.type,
          status: "PENDING",
          tableId: original.tableId ?? undefined,
          customerName: original.customerName ?? undefined,
          customerPhone: original.customerPhone ?? undefined,
          customerId: original.customerId ?? undefined,
          createdById: session.userId,
          isPriority: original.isPriority,
        },
      });
      // Re-assign selected items to new order
      await tx.orderItem.updateMany({
        where: { id: { in: itemIds }, orderId: id },
        data: { orderId: created.id },
      });
      return tx.order.findUnique({
        where: { id: created.id },
        include: { items: { include: { menuItem: true } }, table: true },
      });
    });

    return NextResponse.json({ newOrder });
  });
}
