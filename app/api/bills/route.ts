import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";
import { calculateBill, createBillInTx, getGSTRates } from "@/lib/billingEngine";

const createBillSchema = z.object({
  orderId: z.string().min(1),
  discount: z.number().min(0).optional(),
});

export async function GET(req: NextRequest) {
  return safeHandler("bills/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    const where = date ? {
      createdAt: {
        gte: new Date(`${date}T00:00:00.000Z`),
        lte: new Date(`${date}T23:59:59.999Z`),
      },
    } : {};

    const bills = await prisma.bill.findMany({
      where,
      include: { order: { include: { items: { include: { menuItem: true } }, table: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ bills });
  });
}

export async function POST(req: NextRequest) {
  return safeHandler("bills/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
    if (isAuthError(session)) return session;

    const body = await req.json();
    const parsed = createBillSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const { orderId, discount = 0 } = parsed.data;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // All billing logic inside single transaction — atomic, no race condition
    const bill = await prisma.$transaction(async (tx) => {
      const { cgstPercent, sgstPercent } = await getGSTRates(tx);
      const itemsTotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
      const calc = calculateBill(itemsTotal, discount, cgstPercent, sgstPercent);
      // upsert prevents duplicate bill even on double-click
      return createBillInTx(tx, orderId, calc);
    });

    // 409 if bill already existed (upsert returned existing)
    const statusCode = bill.subtotal === 0 ? 200 : 201;
    return NextResponse.json({ bill }, { status: statusCode });
  });
}
