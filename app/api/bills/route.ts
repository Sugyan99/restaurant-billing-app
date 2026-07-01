import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";

const createBillSchema = z.object({
  orderId: z.string().min(1),
  discount: z.number().min(0).optional(),
});

export async function GET(req: NextRequest) {
  const session = requireAuth(req);
  if (isAuthError(session)) return session;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD

  const where = date
    ? {
        createdAt: {
          gte: new Date(`${date}T00:00:00.000Z`),
          lte: new Date(`${date}T23:59:59.999Z`),
        },
      }
    : {};

  const bills = await prisma.bill.findMany({
    where,
    include: {
      order: {
        include: {
          items: { include: { menuItem: true } },
          table: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ bills });
}

export async function POST(req: NextRequest) {
  const session = requireAuth(req, ["OWNER", "MANAGER", "CASHIER"]);
  if (isAuthError(session)) return session;

  const body = await req.json();
  const parsed = createBillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
  }

  const { orderId, discount = 0 } = parsed.data;

  // Check if bill already exists for this order
  const existing = await prisma.bill.findUnique({ where: { orderId } });
  if (existing) {
    return NextResponse.json(
      { error: "A bill already exists for this order" },
      { status: 409 }
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Get GST rates from restaurant settings
  const settings = await prisma.settings.findFirst();
  const cgstPercent = settings?.cgstPercent ?? 2.5;
  const sgstPercent = settings?.sgstPercent ?? 2.5;

  // Calculate bill amounts
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const taxableAmount = subtotal - discount;
  const cgst = parseFloat(((taxableAmount * cgstPercent) / 100).toFixed(2));
  const sgst = parseFloat(((taxableAmount * sgstPercent) / 100).toFixed(2));
  const total = parseFloat((taxableAmount + cgst + sgst).toFixed(2));

  const bill = await prisma.bill.create({
    data: { orderId, subtotal, cgst, sgst, discount, total },
    include: {
      order: { include: { items: { include: { menuItem: true } }, table: true } },
    },
  });

  return NextResponse.json({ bill }, { status: 201 });
}
