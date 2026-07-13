import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  return safeHandler("staff-report/GET", async () => {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? "7");
  const since = new Date(Date.now() - days * 86400000);

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true, email: true },
  });

  const stats = await Promise.all(users.map(async u => {
    const orders = await prisma.order.findMany({
      where: { createdById: u.id, createdAt: { gte: since } },
      include: { bill: { select: { total: true, paymentStatus: true } } },
    });
    const paid = orders.filter(o => o.bill?.paymentStatus === "PAID");
    const revenue = paid.reduce((s, o) => s + (o.bill?.total ?? 0), 0);
    return {
      ...u,
      totalOrders: orders.length,
      paidOrders: paid.length,
      revenue: parseFloat(revenue.toFixed(2)),
    };
  }));

  return NextResponse.json({ stats: stats.sort((a, b) => b.revenue - a.revenue) });
});
}
