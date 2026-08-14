import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  return safeHandler("staff-report/GET", async () => {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const { searchParams } = new URL(req.url);
  const days  = parseInt(searchParams.get("days") ?? "7");
  const since = new Date(Date.now() - days * 86400000);

  const tid = session.tenantId;
  const memberIds = (await prisma.tenantMembership.findMany({
    where: { tenantId: tid },
    select: { userId: true },
  })).map(m => m.userId);

  const users = await prisma.user.findMany({
    where: { id: { in: memberIds }, isActive: true },
    select: { id: true, name: true, role: true, email: true, salary: true },
  });

  const stats = await Promise.all(users.map(async u => {
    const orders = await prisma.order.findMany({
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

  return NextResponse.json({ stats: stats.sort((a, b) => b.revenue - a.revenue) });
});
}

export async function PUT(req: NextRequest) {
  return safeHandler("staff-report/PUT", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;
    const { userId, salary } = await req.json();
    await prisma.user.update({ where: { id: userId }, data: { salary } });
    return NextResponse.json({ success: true });
  });
}
