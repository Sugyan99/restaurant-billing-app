import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";
import { finalizePayment } from "@/lib/billingEngine";

const paySchema = z.object({
  paymentMode: z.enum(["CASH", "UPI", "CARD", "CREDIT"]),
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
      return NextResponse.json(
        { error: "Payment mode required: CASH, UPI, CARD or CREDIT" },
        { status: 400 }
      );
    }

    const bill = await prisma.bill.findUnique({
      where: { id },
      include: { order: { include: { table: true } } },
    });
    if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    // Idempotent — return existing paid bill instead of error on double-click
    if (bill.paymentStatus === "PAID") {
      return NextResponse.json({ bill, alreadyPaid: true });
    }

    const updatedBill = await prisma.$transaction(async (tx) => {
      const paid = await tx.bill.update({
        where: { id },
        data: { paymentMode: parsed.data.paymentMode, paymentStatus: "PAID" },
        include: { order: { include: { items: { include: { menuItem: true } }, table: true } } },
      });
      // Shared post-payment side effects via engine (order SERVED, table FREE, loyalty pts)
      await finalizePayment(tx, {
        orderId: paid.orderId,
        total: paid.total,
        order: { tableId: paid.order.tableId, customerPhone: paid.order.customerPhone },
      });
      return paid;
    });

    return NextResponse.json({ bill: updatedBill });
  });
}
