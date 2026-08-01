import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

// PUT /api/orders/[id]/transfer — move order to different table OR merge into another order
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("orders/[id]/transfer/PUT", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const { id } = await params;
    const { tableId, mergeIntoOrderId } = await req.json() as {
      tableId?: string;
      mergeIntoOrderId?: string;
    };

    // ── Merge KOT ──
    if (mergeIntoOrderId) {
      const [source, target] = await Promise.all([
        prisma.order.findUnique({ where: { id }, include: { items: true } }),
        prisma.order.findUnique({ where: { id: mergeIntoOrderId } }),
      ]);
      if (!source || !target) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      if (source.id === target.id) return NextResponse.json({ error: "Cannot merge order with itself" }, { status: 400 });

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.orderItem.updateMany({ where: { orderId: source.id }, data: { orderId: target.id } });
        await tx.order.update({ where: { id: source.id }, data: { status: "CANCELLED" } });
        // Free source table if empty
        if (source.tableId) {
          const remaining = await tx.order.count({
            where: { tableId: source.tableId, status: { in: ["PENDING","PREPARING","READY"] }, id: { not: source.id } },
          });
          if (remaining === 0) await tx.restaurantTable.update({ where: { id: source.tableId }, data: { status: "FREE" } });
        }
      });

      const merged = await prisma.order.findUnique({
        where: { id: mergeIntoOrderId },
        include: { items: { include: { menuItem: true } }, table: true },
      });
      return NextResponse.json({ order: merged });
    }

    // ── Table Transfer ──
    if (!tableId) return NextResponse.json({ error: "tableId or mergeIntoOrderId required" }, { status: 400 });

    const order = await prisma.order.findUnique({ where: { id }, include: { table: true } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const newTable = await prisma.restaurantTable.findUnique({ where: { id: tableId } });
    if (!newTable) return NextResponse.json({ error: "Table not found" }, { status: 404 });

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const u = await tx.order.update({
        where: { id },
        data: { tableId },
        include: { items: { include: { menuItem: true } }, table: true },
      });
      // Set new table OCCUPIED
      await tx.restaurantTable.update({ where: { id: tableId }, data: { status: "OCCUPIED" } });
      // Free old table if no remaining active orders
      if (order.tableId && order.tableId !== tableId) {
        const remaining = await tx.order.count({
          where: { tableId: order.tableId, status: { in: ["PENDING","PREPARING","READY"] }, id: { not: id } },
        });
        if (remaining === 0) await tx.restaurantTable.update({ where: { id: order.tableId }, data: { status: "FREE" } });
      }
      return u;
    });

    return NextResponse.json({ order: updated });
  });
}
