import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

    const bill = await prisma.bill.findUnique({
      where: { id },
      include: { order: { include: { table: true } } },
    });
    if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.bill.delete({ where: { id } });
      // Reset order status back to READY so it can be re-billed
      await tx.order.update({ where: { id: bill.orderId }, data: { status: "READY" } });
      // If table was freed by this bill, re-occupy it
      if (bill.order.tableId) {
        await tx.restaurantTable.update({
          where: { id: bill.order.tableId },
          data: { status: "OCCUPIED" },
        });
      }
    });

    return NextResponse.json({ success: true });
  });
}
