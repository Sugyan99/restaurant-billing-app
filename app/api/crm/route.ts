import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  return safeHandler("crm/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "analytics";

    if (type === "birthdays") {
      const month = searchParams.get("month") ?? (new Date().getMonth() + 1).toString().padStart(2, "0");
      // birthday stored as YYYY-MM-DD or MM-DD
      const customers = await prisma.customer.findMany({
        where: {
          birthday: { not: null },
        },
        select: { id: true, name: true, phone: true, email: true, birthday: true, loyaltyPoints: true, totalVisits: true },
        orderBy: { name: "asc" },
      });
      // Filter by month in JS (birthday could be MM-DD or YYYY-MM-DD)
      const filtered = customers.filter(c => {
        if (!c.birthday) return false;
        const parts = c.birthday.split("-");
        const m = parts.length === 3 ? parts[1] : parts[0];
        return m === month.padStart(2, "0");
      });
      return NextResponse.json({ customers: filtered, month });
    }

    // analytics
    const [
      totalCustomers,
      newThisMonth,
      topCustomers,
      avgStats,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      prisma.customer.findMany({
        select: {
          id: true, name: true, phone: true,
          totalSpent: true, totalVisits: true, loyaltyPoints: true,
        },
        orderBy: { totalSpent: "desc" },
        take: 10,
      }),
      prisma.customer.aggregate({
        _avg: { totalSpent: true, totalVisits: true, loyaltyPoints: true },
        _sum: { totalSpent: true },
      }),
    ]);

    // Segments
    const vip = await prisma.customer.count({ where: { loyaltyPoints: { gte: 5000 } } });
    const silver = await prisma.customer.count({
      where: { loyaltyPoints: { gte: 1000, lt: 5000 } },
    });
    const bronze = await prisma.customer.count({
      where: { loyaltyPoints: { lt: 1000, gt: 0 } },
    });
    const newCustomers = await prisma.customer.count({ where: { totalVisits: { lte: 1 } } });

    // Monthly new customers (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const monthlyRaw = await prisma.$queryRaw<{ month: string; count: bigint }[]>`
      SELECT TO_CHAR("createdAt", 'YYYY-MM') as month, COUNT(*) as count
      FROM "Customer"
      WHERE "createdAt" >= ${sixMonthsAgo}
      GROUP BY month ORDER BY month ASC
    `;
    const monthly = monthlyRaw.map(r => ({ month: r.month, count: Number(r.count) }));

    const feedbackStats = await prisma.customerFeedback.aggregate({
      _avg: { rating: true },
      _count: { id: true },
    });

    return NextResponse.json({
      totalCustomers,
      newThisMonth,
      topCustomers,
      avgStats,
      segments: { vip, silver, bronze, new: newCustomers },
      monthly,
      feedbackStats,
    });
  });
}
