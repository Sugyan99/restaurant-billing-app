import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";
import { calculateBill, createInvoice, cartMergeDuplicates, getGSTRates } from "@/lib/billingEngine";

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
      include: { items: { include: { menuItem: { select: { name: true } } } } },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Build cart from order items for draft/audit
    const cart = cartMergeDuplicates({
      items: order.items.map(i => ({
        menuItemId: i.menuItemId,
        name: i.menuItem?.name ?? i.menuItemId,
        price: i.price,
        quantity: i.quantity,
      })),
    });

    // Get GST rates for calculation
    const settings = await prisma.settings.findFirst({ select: { cgstPercent: true, sgstPercent: true } });
    const cgstPercent = settings?.cgstPercent ?? 2.5;
    const sgstPercent = settings?.sgstPercent ?? 2.5;
    const itemsTotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const calc = calculateBill(itemsTotal, discount, cgstPercent, sgstPercent, taxConfig);

    // createInvoice: lock + draft + atomic tx + audit log
    const { bill } = await createInvoice(prisma, orderId, calc, cart, session.userId);
    return NextResponse.json({ bill }, { status: 201 });
  });
}
