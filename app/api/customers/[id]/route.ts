import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("customers/[id]/GET", async () => {
    const session = requireAuth(req);
  if (isAuthError(session)) return session;
  const { id } = await params;

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orders = await prisma.order.findMany({
    where: { customerPhone: customer.phone },
    include: {
      items: { include: { menuItem: { select: { name: true } } } },
      bill: { select: { total: true, paymentStatus: true, paymentMode: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Derive favorite items from all orders
  const itemCount: Record<string, { name: string; count: number }> = {};
  for (const order of orders) {
    for (const item of order.items) {
      const name = item.menuItem?.name ?? "Unknown";
      if (!itemCount[name]) itemCount[name] = { name, count: 0 };
      itemCount[name].count += item.quantity;
    }
  }
  const favoriteItems = Object.values(itemCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const feedback = await prisma.customerFeedback.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return NextResponse.json({ customer, orders, favoriteItems, feedback });
});
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("customers/[id]/PUT", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;
  const { id } = await params;
  const body = await req.json();
  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: body.name,
      email: body.email || null,
      address: body.address || null,
      notes: body.notes || null,
      birthday: body.birthday || null,
      gender: body.gender || null,
      creditBalance: Math.max(0, body.creditBalance ?? 0),
    },
  });
  return NextResponse.json({ customer
  });
});
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("customers/[id]/DELETE", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    // Check no active orders linked to this phone
    const active = await prisma.order.count({
      where: { customerPhone: customer.phone, status: { in: ["PENDING","PREPARING","READY"] } },
    });
    if (active > 0) return NextResponse.json({ error: "Customer has active orders" }, { status: 400 });
    await prisma.order.updateMany({ where: { customerId: id }, data: { customerId: null } });
    await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  });
}
