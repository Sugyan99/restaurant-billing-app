import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("customers/[id]/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;
    const { id } = await params;

    const data = await withTenant(session.tenantId, session.userId, async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id, tenantId: session.tenantId } });
      if (!customer) return null;

      const orders = await tx.order.findMany({
        where: { customerPhone: customer.phone, tenantId: session.tenantId },
        include: {
          items: { include: { menuItem: { select: { name: true } } } },
          bill: { select: { total: true, paymentStatus: true, paymentMode: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      const feedback = await tx.customerFeedback.findMany({
        where: { customerId: customer.id, tenantId: session.tenantId },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      return { customer, orders, feedback };
    });

    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const itemCount: Record<string, { name: string; count: number }> = {};
    for (const order of data.orders) {
      for (const item of order.items) {
        const name = item.menuItem?.name ?? "Unknown";
        if (!itemCount[name]) itemCount[name] = { name, count: 0 };
        itemCount[name].count += item.quantity;
      }
    }
    const favoriteItems = Object.values(itemCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({ customer: data.customer, orders: data.orders, favoriteItems, feedback: data.feedback });
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
    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      const existing = await tx.customer.findFirst({ where: { id, tenantId: session.tenantId } });
      if (!existing) return { notFound: true } as const;
      const customer = await tx.customer.update({
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
      return { customer } as const;
    });
    if ("notFound" in result) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    return NextResponse.json({ customer: (result as { customer: unknown }).customer });
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

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id, tenantId: session.tenantId } });
      if (!customer) return { notFound: true } as const;
      const active = await tx.order.count({
        where: { customerPhone: customer.phone, status: { in: ["PENDING", "PREPARING", "READY"] }, tenantId: session.tenantId },
      });
      if (active > 0) return { hasActive: true } as const;
      await tx.order.updateMany({ where: { customerId: id, tenantId: session.tenantId }, data: { customerId: null } });
      await tx.customer.delete({ where: { id } });
      return { success: true } as const;
    });

    if ("notFound" in result) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    if ("hasActive" in result) return NextResponse.json({ error: "Customer has active orders" }, { status: 400 });
    return NextResponse.json({ success: true });
  });
}
