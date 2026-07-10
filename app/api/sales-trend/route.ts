import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const now = new Date();

  // Last 7 days daily revenue - OPTIMIZED: Single query instead of 7
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 6);
  startDate.setHours(0, 0, 0, 0);

  const bills = await prisma.bill.findMany({
    where: {
      paymentStatus: "PAID",
      createdAt: { gte: startDate, lte: now },
    },
  });

  // Group bills by day in memory
  const days: { date: string; revenue: number; orders: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const nextDay = new Date(d);
    nextDay.setDate(d.getDate() + 1);

    const dayBills = bills.filter(
      (b) => b.createdAt >= d && b.createdAt < nextDay
    );

    days.push({
      date: d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
      }),
      revenue: parseFloat(
        dayBills.reduce((s, b) => s + b.total, 0).toFixed(2)
      ),
      orders: dayBills.length,
    });
  }

  // Today hourly breakdown
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayBills = bills.filter((b) => b.createdAt >= todayStart);
  const hourly: Record<number, number> = {};
  for (const bill of todayBills) {
    const h = new Date(bill.createdAt).getHours();
    hourly[h] = (hourly[h] ?? 0) + bill.total;
  }

  // Peak hour - FIX: Convert hour to number
  const peakHourEntry = Object.entries(hourly).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const peakHour = peakHourEntry
    ? {
        hour: parseInt(peakHourEntry[0], 10),
        revenue: parseFloat(peakHourEntry[1].toFixed(2)),
      }
    : null;

  return NextResponse.json({ daily: days, hourly, peakHour });
}
