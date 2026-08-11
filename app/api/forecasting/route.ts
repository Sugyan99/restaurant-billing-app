import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  return safeHandler("forecasting/GET", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;

    const now = new Date();
    // Fetch last 30 days of paid bills
    const since = new Date(now);
    since.setDate(now.getDate() - 29);
    since.setHours(0, 0, 0, 0);

    const bills = await prisma.bill.findMany({
      where: { paymentStatus: "PAID", createdAt: { gte: since } },
      select: { total: true, createdAt: true },
    });

    // Build daily revenue map
    const dailyMap: Record<string, { revenue: number; orders: number }> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { revenue: 0, orders: 0 };
    }
    for (const b of bills) {
      const key = new Date(b.createdAt).toISOString().slice(0, 10);
      if (dailyMap[key]) { dailyMap[key].revenue += b.total; dailyMap[key].orders++; }
    }

    const historical = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    // Simple linear regression on revenue
    const n = historical.length;
    const xs = historical.map((_, i) => i);
    const ys = historical.map(d => d.revenue);
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
    const sumX2 = xs.reduce((s, x) => s + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
    const intercept = (sumY - slope * sumX) / n;

    // 7-day moving average for smoothing
    const recentRevs = ys.slice(-7);
    const avgRecent = recentRevs.reduce((a, b) => a + b, 0) / 7;

    // Generate 7-day forecast (blend linear regression + moving average)
    const forecast: { date: string; predicted: number; low: number; high: number }[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const x = n + i - 1;
      const linear = slope * x + intercept;
      // Blend 60% moving avg + 40% linear
      const predicted = Math.max(0, 0.6 * avgRecent + 0.4 * linear);
      forecast.push({
        date: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
        predicted: parseFloat(predicted.toFixed(2)),
        low:  parseFloat((predicted * 0.8).toFixed(2)),
        high: parseFloat((predicted * 1.2).toFixed(2)),
      });
    }

    // Week-on-week comparison
    const thisWeekRev = ys.slice(-7).reduce((a, b) => a + b, 0);
    const lastWeekRev = ys.slice(-14, -7).reduce((a, b) => a + b, 0);
    const wow = lastWeekRev > 0 ? ((thisWeekRev - lastWeekRev) / lastWeekRev) * 100 : 0;

    return NextResponse.json({
      historical: historical.slice(-14), // Last 14 days
      forecast,
      summary: {
        avgDailyRevenue: parseFloat((sumY / n).toFixed(2)),
        thisWeekRevenue: parseFloat(thisWeekRev.toFixed(2)),
        lastWeekRevenue: parseFloat(lastWeekRev.toFixed(2)),
        weekOnWeekGrowth: parseFloat(wow.toFixed(1)),
        forecastNextWeek: parseFloat(forecast.reduce((s, f) => s + f.predicted, 0).toFixed(2)),
      },
    });
  });
}
