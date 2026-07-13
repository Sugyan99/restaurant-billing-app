import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";

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
      { error: "Payment mode is required (CASH, UPI, CARD, or CREDIT)" },
      { status: 400 }
    );
  }

  const bill = await prisma.bill.findUnique({
    where: { id },
    include: { order: { include: { table: true } } },
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404
  });
}

  if (bill.paymentStatus === "PAID") {
    return NextResponse.json({ error: "This bill is already paid" }, { status: 400 });
  }

  // Mark bill paid + mark order SERVED + free the table in one transaction
  const updatedBill = await prisma.$transaction(async (tx) => {
    const paid = await tx.bill.update({
      where: { id },
      data: {
        paymentMode: parsed.data.paymentMode,
        paymentStatus: "PAID",
      },
      include: {
        order: { include: { items: { include: { menuItem: true } }, table: true } },
      },
    });

    await tx.order.update({
      where: { id: paid.orderId },
      data: { status: "SERVED" },
    });

    if (paid.order.tableId) {
      const remaining = await tx.order.count({
        where: {
          tableId: paid.order.tableId,
          status: { in: ["PENDING", "PREPARING", "READY"] },
        },
      });
      if (remaining === 0) {
        await tx.restaurantTable.update({
          where: { id: paid.order.tableId },
          data: { status: "FREE" },
        });
      }
    }

    // Auto-update customer stats + loyalty points (1 pt per ₹10)
    if (paid.order.customerPhone) {
      const pointsEarned = Math.floor(paid.total / 10);
      await tx.customer.updateMany({
        where: { phone: paid.order.customerPhone },
        data: {
          totalVisits: { increment: 1 },
          totalSpent: { increment: paid.total },
          loyaltyPoints: { increment: pointsEarned },
        },
      });
    }

    return paid;
  });

  return NextResponse.json({ bill: updatedBill });
});
}
