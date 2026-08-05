import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";
import { finalizePayment, auditLog } from "@/lib/billingEngine";

export type SplitPaymentEntry = { mode: "CASH" | "UPI" | "CARD" | "CREDIT"; amount: number };

const splitSchema = z.object({
  payments: z.array(z.object({
    mode: z.enum(["CASH", "UPI", "CARD", "CREDIT"]),
    amount: z.number().positive(),
  })).min(1),
  tip: z.number().min(0).default(0),
  roundOff: z.number().default(0),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("bills/[id]/split/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;

    const { id } = await params;
    const body = await req.json();
    const parsed = splitSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const bill = await prisma.bill.findUnique({
      where: { id },
      include: { order: { include: { table: true } } },
    });
    if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    if (bill.paymentStatus === "PAID") return NextResponse.json({ bill, alreadyPaid: true });
    if ((bill as any).billStatus === "VOID") return NextResponse.json({ error: "Cannot pay a voided bill" }, { status: 400 });
    if ((bill as any).billStatus === "HOLD") return NextResponse.json({ error: "Bill is on hold — remove hold first" }, { status: 400 });
    if ((bill as any).discountApprovalStatus === "PENDING") {
      return NextResponse.json({ error: "Discount awaiting manager approval" }, { status: 400 });
    }

    const { tip, roundOff, payments } = parsed.data;
    const finalTotal = bill.total + tip + roundOff;
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

    if (Math.abs(totalPaid - finalTotal) > 0.5) {
      return NextResponse.json({
        error: `Split total ₹${totalPaid.toFixed(2)} must equal bill total ₹${finalTotal.toFixed(2)}`,
      }, { status: 400 });
    }

    const primaryMode = [...payments].sort((a, b) => b.amount - a.amount)[0].mode;
    const paymentStatus = totalPaid >= finalTotal - 0.01 ? "PAID" : "PARTIALLY_PAID";

    const updated = await prisma.$transaction(async (tx) => {
      const paid = await (tx.bill as any).update({
        where: { id },
        data: {
          paymentMode: primaryMode,
          paymentStatus,
          splitPayments: payments as unknown as import("@prisma/client").Prisma.InputJsonValue,
          tip,
          roundOff,
          total: finalTotal,
          paidAmount: totalPaid,
        },
        include: { order: { include: { table: true } } },
      });
      await auditLog(tx as any, "BILL_SPLIT_PAID", paid.orderId, session.userId, {
        payments,
        tip,
        roundOff,
        total: finalTotal,
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

    return NextResponse.json({ bill: updated });
  });
}
