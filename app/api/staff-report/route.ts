import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  return safeHandler("staff-report/GET", async () => {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const { searchParams } = new URL(req.url);
  const days  = parseInt(searchParams.get("days") ?? "7");
  const since = new Date(Date.now() - days * 86400000);

  const tid = session.tenantId;

  const stats = await withTenant(session.tenantId, session.userId, async (tx) => {
    const memberIds = (await tx.tenantMembership.findMany({
      where: { tenantId: tid },
      select: { userId: true },
    })).map(m => m.userId);

    const users = await tx.user.findMany({
      where: { id: { in: memberIds }, isActive: true },
      select: { id: true, name: true, role: true, email: true, salary: true },
    });

    return Promise.all(users.map(async u => {
    const orders = await tx.order.findMany({
      where: { tenantId: tid, createdById: u.id, createdAt: { gte: since } },
      include: { bill: { select: { total: true, paymentStatus: true } } },
    });
    const paid      = orders.filter(o => o.bill?.paymentStatus === "PAID");
    const revenue   = paid.reduce((s, o) => s + (o.bill?.total ?? 0), 0);
    // Daily salary cost for the period
    const dailyCost = (u.salary ?? 0) / 30;
    const laborCost = dailyCost * days;
    const laborPct  = revenue > 0 ? (laborCost / revenue) * 100 : null;
    return {
      ...u,
      totalOrders: orders.length,
      paidOrders:  paid.length,
      revenue:     parseFloat(revenue.toFixed(2)),
      laborCost:   parseFloat(laborCost.toFixed(2)),
      laborPct:    laborPct !== null ? parseFloat(laborPct.toFixed(1)) : null,
    };
    }));
  });

  return NextResponse.json({ stats: stats.sort((a, b) => b.revenue - a.revenue) });
});
}

export async function PUT(req: NextRequest) {
  return safeHandler("staff-report/PUT", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;
    const { userId, salary } = await req.json();

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      const membership = await tx.tenantMembership.findFirst({
        where: { userId, tenantId: session.tenantId },
      });
      if (!membership) return { notFound: true } as const;
      await tx.user.update({ where: { id: userId }, data: { salary } });
      return { success: true } as const;
    });

    if ("notFound" in result) return NextResponse.json({ error: "User not found in your restaurant" }, { status: 404 });
    return NextResponse.json({ success: true });
  });
}
