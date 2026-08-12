import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

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

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      const original = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!original) return { notFound: true } as const;

      const remainingItems = original.items.filter((i) => !itemIds.includes(i.id));
      if (remainingItems.length === 0) return { emptyOriginal: true } as const;

      const created = await tx.order.create({
        data: {
          tenantId: session.tenantId,
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

      await tx.orderItem.updateMany({
        where: { id: { in: itemIds }, orderId: id, tenantId: session.tenantId },
        data: { orderId: created.id },
      });

      const newOrder = await tx.order.findUnique({
        where: { id: created.id },
        include: { items: { include: { menuItem: true } }, table: true },
      });
      return { newOrder } as const;
    });

    if ("notFound" in result) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if ("emptyOriginal" in result) return NextResponse.json({ error: "Cannot move all items — original KOT would be empty" }, { status: 400 });
    return NextResponse.json({ newOrder: (result as { newOrder: unknown }).newOrder });
  });
}
