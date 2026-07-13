import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  return safeHandler("gst-report/GET", async () => {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const bills = await prisma.bill.findMany({
    where: { paymentStatus: "PAID", createdAt: { gte: start, lte: end } },
    include: { order: { include: { items: { include: { menuItem: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  const settings = await prisma.settings.findFirst();

  const totalTaxable = bills.reduce((s, b) => s + (b.subtotal - b.discount), 0);
  const totalCgst = bills.reduce((s, b) => s + b.cgst, 0);
  const totalSgst = bills.reduce((s, b) => s + b.sgst, 0);
  const totalRevenue = bills.reduce((s, b) => s + b.total, 0);

  // Daily breakdown
  const dailyMap: Record<string, { date: string; taxable: number; cgst: number; sgst: number; total: number; bills: number }> = {};
  for (const bill of bills) {
    const day = bill.createdAt.toISOString().split("T")[0];
    if (!dailyMap[day]) dailyMap[day] = { date: day, taxable: 0, cgst: 0, sgst: 0, total: 0, bills: 0 };
    dailyMap[day].taxable += bill.subtotal - bill.discount;
    dailyMap[day].cgst += bill.cgst;
    dailyMap[day].sgst += bill.sgst;
    dailyMap[day].total += bill.total;
    dailyMap[day].bills += 1;
  }

  return NextResponse.json({
    month, year,
    gstin: settings?.gstNumber ?? null,
    restaurantName: settings?.restaurantName ?? "Restaurant",
    summary: {
      totalBills: bills.length,
      totalTaxable: parseFloat(totalTaxable.toFixed(2)),
      totalCgst: parseFloat(totalCgst.toFixed(2)),
      totalSgst: parseFloat(totalSgst.toFixed(2)),
      totalTax: parseFloat((totalCgst + totalSgst).toFixed(2)),
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    },
    daily: Object.values(dailyMap),
    bills: bills.map(b => ({
      billNumber: b.billNumber,
      date: b.createdAt,
      subtotal: b.subtotal,
      discount: b.discount,
      taxable: parseFloat((b.subtotal - b.discount).toFixed(2)),
      cgst: b.cgst,
      sgst: b.sgst,
      total: b.total,
    })),
  });
});
}
