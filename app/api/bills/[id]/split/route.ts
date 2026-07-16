import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";
import { finalizePayment } from "@/lib/billingEngine";

const splitSchema = z.object({
  payments: z.array(z.object({
    mode: z.enum(["CASH", "UPI", "CARD", "CREDIT"]),
    amount: z.number().positive(),
  })).min(1),
});

export type SplitPaymentEntry = { mode: "CASH" | "UPI" | "CARD" | "CREDIT"; amount: number };

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
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const bill = await prisma.bill.findUnique({
      where: { id },
      include: { order: { include: { table: true } } },
    });
    if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    // Idempotent on double-click
    if (bill.paymentStatus === "PAID") {
      return NextResponse.json({ bill, alreadyPaid: true });
    }

    const totalPaid = parsed.data.payments.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(totalPaid - bill.total) > 0.01) {
      return NextResponse.json({
        error: `Split total ₹${totalPaid.toFixed(2)} must equal bill total ₹${bill.total.toFixed(2)}`,
      }, { status: 400 });
    }

    // Largest amount determines primary payment mode
    const primaryMode = [...parsed.data.payments].sort((a, b) => b.amount - a.amount)[0].mode;
    // Typed — no more `as any`
    const splitPayments: SplitPaymentEntry[] = parsed.data.payments;

    const updated = await prisma.$transaction(async (tx) => {
      const paid = await tx.bill.update({
        where: { id },
        data: {
          paymentMode: primaryMode,
          paymentStatus: "PAID",
          splitPayments: splitPayments as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
        include: { order: { include: { table: true } } },
      });
      // Now includes loyalty points — was missing in previous split route
      await finalizePayment(tx, {
        orderId: paid.orderId,
        total: paid.total,
        order: { tableId: paid.order.tableId, customerPhone: paid.order.customerPhone },
      });
      return paid;
    });

    return NextResponse.json({ bill: updated });
  });
}
