import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const [bills, expenses, dayCloses] = await Promise.all([
    prisma.bill.findMany({ where: { paymentStatus: "PAID", createdAt: { gte: start, lte: end } } }),
    prisma.expense.findMany({ where: { date: { gte: start, lte: end } } }),
    prisma.dayClose.findMany({ where: { date: { gte: start, lte: end } }, orderBy: { date: "asc" } }),
  ]);

  const revenue = bills.reduce((s, b) => s + b.total, 0);
  const tax = bills.reduce((s, b) => s + b.cgst + b.sgst, 0);
  const revenueExTax = revenue - tax;
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const grossProfit = revenueExTax - totalExpenses;

  // Expense breakdown by category
  const expenseByCategory: Record<string, number> = {};
  for (const e of expenses) {
    expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + e.amount;
  }

  // Payment mode breakdown
  const paymentBreakdown: Record<string, number> = {};
  for (const b of bills) {
    const mode = b.paymentMode ?? "UNKNOWN";
    paymentBreakdown[mode] = (paymentBreakdown[mode] ?? 0) + b.total;
  }

  return NextResponse.json({
    month, year,
    revenue: parseFloat(revenue.toFixed(2)),
    revenueExTax: parseFloat(revenueExTax.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    totalExpenses: parseFloat(totalExpenses.toFixed(2)),
    grossProfit: parseFloat(grossProfit.toFixed(2)),
    profitMargin: revenue > 0 ? parseFloat(((grossProfit / revenueExTax) * 100).toFixed(1)) : 0,
    totalOrders: bills.length,
    expenseByCategory,
    paymentBreakdown,
    dayCloses: dayCloses.length,
  });
}
