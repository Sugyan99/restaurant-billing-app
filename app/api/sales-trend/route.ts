import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const now = new Date();

  // Last 7 days daily revenue
  const days: { date: string; revenue: number; orders: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const bills = await prisma.bill.findMany({ where: { paymentStatus: "PAID", createdAt: { gte: d, lt: next } } });
    days.push({
      date: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
      revenue: parseFloat(bills.reduce((s, b) => s + b.total, 0).toFixed(2)),
      orders: bills.length,
    });
  }

  // Today hourly breakdown
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayBills = await prisma.bill.findMany({ where: { paymentStatus: "PAID", createdAt: { gte: todayStart } } });
  const hourly: Record<number, number> = {};
  for (const bill of todayBills) {
    const h = new Date(bill.createdAt).getHours();
    hourly[h] = (hourly[h] ?? 0) + bill.total;
  }
  const peakHour = Object.entries(hourly).sort((a, b) => b[1] - a[1])[0];

  return NextResponse.json({ daily: days, hourly, peakHour: peakHour ? { hour: peakHour[0], revenue: peakHour[1].toFixed(2) } : null });
}
