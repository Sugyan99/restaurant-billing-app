import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("orders/[id]/transfer/PUT", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;
    const { id } = await params;
    const { tableId, mergeIntoOrderId } = await req.json() as { tableId?: string; mergeIntoOrderId?: string };

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      // ── Merge KOT ──
      if (mergeIntoOrderId) {
        const [source, target] = await Promise.all([
          tx.order.findUnique({ where: { id }, include: { items: true } }),
          tx.order.findUnique({ where: { id: mergeIntoOrderId } }),
        ]);
        if (!source || !target) return { notFound: true } as const;
        if (source.id === target.id) return { sameOrder: true } as const;

        await tx.orderItem.updateMany({ where: { orderId: source.id, tenantId: session.tenantId }, data: { orderId: target.id } });
        await tx.order.update({ where: { id: source.id }, data: { status: "CANCELLED" } });

        if (source.tableId) {
          const remaining = await tx.order.count({
            where: { tableId: source.tableId, status: { in: ["PENDING","PREPARING","READY"] }, id: { not: source.id }, tenantId: session.tenantId },
          });
          if (remaining === 0) await tx.restaurantTable.update({ where: { id: source.tableId }, data: { status: "FREE" } });
        }

        const merged = await tx.order.findUnique({
          where: { id: mergeIntoOrderId },
          include: { items: { include: { menuItem: true } }, table: true },
        });
        return { order: merged } as const;
      }

      // ── Table Transfer ──
      if (!tableId) return { noInput: true } as const;

      const order = await tx.order.findUnique({ where: { id }, include: { table: true } });
      if (!order) return { notFound: true } as const;
      const newTable = await tx.restaurantTable.findUnique({ where: { id: tableId } });
      if (!newTable) return { noTable: true } as const;

      const updated = await tx.order.update({
        where: { id },
        data: { tableId },
        include: { items: { include: { menuItem: true } }, table: true },
      });
      await tx.restaurantTable.update({ where: { id: tableId }, data: { status: "OCCUPIED" } });
      if (order.tableId && order.tableId !== tableId) {
        const remaining = await tx.order.count({
          where: { tableId: order.tableId, status: { in: ["PENDING","PREPARING","READY"] }, id: { not: id }, tenantId: session.tenantId },
        });
        if (remaining === 0) await tx.restaurantTable.update({ where: { id: order.tableId }, data: { status: "FREE" } });
      }
      return { order: updated } as const;
    });

    if ("noInput" in result) return NextResponse.json({ error: "tableId or mergeIntoOrderId required" }, { status: 400 });
    if ("notFound" in result) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if ("sameOrder" in result) return NextResponse.json({ error: "Cannot merge order with itself" }, { status: 400 });
    if ("noTable" in result) return NextResponse.json({ error: "Table not found" }, { status: 404 });
    return NextResponse.json({ order: (result as { order: unknown }).order });
  });
}
