import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";

const splitSchema = z.object({
  payments: z.array(z.object({
    mode: z.enum(["CASH", "UPI", "CARD", "CREDIT"]),
    amount: z.number().positive(),
  })).min(1),
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
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400
  });
}

  const bill = await prisma.bill.findUnique({ where: { id }, include: { order: { include: { table: true } } } });
  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  if (bill.paymentStatus === "PAID") return NextResponse.json({ error: "Bill already paid" }, { status: 400 });

  const totalPaid = parsed.data.payments.reduce((s, p) => s + p.amount, 0);
  if (Math.abs(totalPaid - bill.total) > 0.01) {
    return NextResponse.json({ error: `Payment total ₹${totalPaid.toFixed(2)} must equal bill total ₹${bill.total.toFixed(2)}` }, { status: 400 });
  }

  const primaryMode = parsed.data.payments.sort((a, b) => b.amount - a.amount)[0].mode;

  const updated = await prisma.$transaction(async (tx) => {
    const paid = await tx.bill.update({
      where: { id },
      data: {
        paymentMode: primaryMode,
        paymentStatus: "PAID",
        splitPayments: parsed.data.payments as any,
      },
      include: { order: { include: { table: true } } },
    });

    await tx.order.update({ where: { id: paid.orderId }, data: { status: "SERVED" } });

    if (paid.order.tableId) {
      const active = await tx.order.count({
        where: { tableId: paid.order.tableId, status: { in: ["PENDING", "PREPARING", "READY"] } },
      });
      if (active === 0) {
        await tx.restaurantTable.update({ where: { id: paid.order.tableId }, data: { status: "FREE" } });
      }
    }
    return paid;
  });

  return NextResponse.json({ bill: updated });
});
}
