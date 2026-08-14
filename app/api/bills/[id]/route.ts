import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { safeHandler } from "@/lib/apiHandler";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("bills/[id]/DELETE", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;

    return withTenant(session.tenantId, session.userId, async (tx) => {
      const bill = await tx.bill.findFirst({
        where: { id, tenantId: session.tenantId },
        include: { order: { include: { table: true } } },
      });
      if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

      await tx.bill.delete({ where: { id } });
      await tx.order.update({ where: { id: bill.orderId }, data: { status: "READY" } });
      if (bill.order.tableId) {
        await tx.restaurantTable.update({ where: { id: bill.order.tableId }, data: { status: "OCCUPIED" } });
      }
      return NextResponse.json({ success: true });
    });
  });
}
