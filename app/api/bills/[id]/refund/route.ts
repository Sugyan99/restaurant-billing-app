import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { auditLog } from "@/lib/billingEngine";
import { z } from "zod";

const schema = z.object({
  reason: z.string().min(1, "Refund reason required"),
  amount: z.number().positive().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("bills/[id]/refund/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Refund reason required" }, { status: 400 });

    return withTenant(session.tenantId, session.userId, async (tx) => {
      const bill = await tx.bill.findFirst({
        where: { id, tenantId: session.tenantId },
        include: { order: { select: { customerPhone: true } } },
      });
      if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
      if (bill.paymentStatus !== "PAID" && bill.paymentStatus !== "PARTIALLY_PAID") {
        return NextResponse.json({ error: "Only paid bills can be refunded" }, { status: 400 });
      }
      if ((bill as any).billStatus === "REFUNDED") {
        return NextResponse.json({ error: "Bill already refunded" }, { status: 400 });
      }

      const refundAmount = parsed.data.amount ?? bill.total;
      if (refundAmount > bill.total) {
        return NextResponse.json({ error: `Refund amount ₹${refundAmount.toFixed(2)} exceeds bill total ₹${bill.total.toFixed(2)}` }, { status: 400 });
      }

      await (tx.bill as any).update({
        where: { id },
        data: { billStatus: "REFUNDED", refundAmount, refundReason: parsed.data.reason, paymentStatus: "PENDING" },
      });
      if (bill.order.customerPhone) {
        const pointsToReverse = Math.floor(refundAmount / 10);
        if (pointsToReverse > 0) {
          await tx.customer.updateMany({
            where: { tenantId: session.tenantId, phone: bill.order.customerPhone },
            data: { totalSpent: { decrement: refundAmount }, loyaltyPoints: { decrement: pointsToReverse } },
          });
        }
      }
      await auditLog(tx as any, "BILL_REFUNDED", bill.orderId, session.userId, { refundAmount, reason: parsed.data.reason });
      return NextResponse.json({ success: true });
    });
  });
}
