import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";
import { finalizePayment, auditLog } from "@/lib/billingEngine";

const paySchema = z.object({
  paymentMode: z.enum(["CASH", "UPI", "CARD", "CREDIT"]),
  tip: z.number().min(0).default(0),
  roundOff: z.number().default(0),
  paidAmount: z.number().positive().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("bills/[id]/pay/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;

    const { id } = await params;
    const body = await req.json();
    const parsed = paySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payment mode required: CASH, UPI, CARD or CREDIT" }, { status: 400 });
    }

    const bill = await prisma.bill.findUnique({
      where: { id },
      include: { order: { include: { table: true } } },
    });
    if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    if (bill.paymentStatus === "PAID") return NextResponse.json({ bill, alreadyPaid: true });
    if ((bill as any).billStatus === "VOID") return NextResponse.json({ error: "Cannot pay a voided bill" }, { status: 400 });
    if ((bill as any).billStatus === "HOLD") return NextResponse.json({ error: "Bill is on hold — remove hold first" }, { status: 400 });
    if ((bill as any).discountApprovalStatus === "PENDING") {
      return NextResponse.json({ error: "Discount awaiting manager approval — cannot collect payment yet" }, { status: 400 });
    }

    const { tip, roundOff, paymentMode } = parsed.data;
    const finalTotal = bill.total + tip + roundOff;
    const paidAmount = parsed.data.paidAmount ?? finalTotal;
    const paymentStatus = paidAmount >= finalTotal - 0.01 ? "PAID" : "PARTIALLY_PAID";

    const updatedBill = await prisma.$transaction(async (tx: any) => {
      const paid = await (tx.bill as any).update({
        where: { id },
        data: {
          paymentMode,
          paymentStatus,
          tip,
          roundOff,
          total: finalTotal,
          paidAmount,
        },
        include: { order: { include: { items: { include: { menuItem: true } }, table: true } } },
      });
      await auditLog(tx as any, "BILL_PAID", paid.orderId, session.userId, {
        paymentMode,
        tip,
        roundOff,
        paidAmount,
        total: finalTotal,
        partial: paymentStatus === "PARTIALLY_PAID",
      });
      if (paymentStatus === "PAID") {
        await finalizePayment(tx as any, {
          orderId: paid.orderId,
          total: paid.total,
          order: { tableId: paid.order.tableId, customerPhone: paid.order.customerPhone },
        });
      }
      return paid;
    });

    return NextResponse.json({ bill: updatedBill });
  });
}
