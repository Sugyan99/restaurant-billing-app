import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // Check if today is already closed
  const existing = await prisma.dayClose.findFirst({
    where: { date: { gte: today, lt: tomorrow } },
  });

  // Today's bills
  const bills = await prisma.bill.findMany({
    where: { paymentStatus: "PAID", createdAt: { gte: today, lt: tomorrow } },
  });

  // Today's expenses
  const expenses = await prisma.expense.findMany({
    where: { date: { gte: today, lt: tomorrow } },
  });

  const totalSales = bills.reduce((s, b) => s + b.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const cashSales = bills.filter(b => b.paymentMode === "CASH").reduce((s, b) => s + b.total, 0);
  const upiSales = bills.filter(b => b.paymentMode === "UPI").reduce((s, b) => s + b.total, 0);
  const cardSales = bills.filter(b => b.paymentMode === "CARD").reduce((s, b) => s + b.total, 0);
  const creditSales = bills.filter(b => b.paymentMode === "CREDIT").reduce((s, b) => s + b.total, 0);

  const settings = await prisma.settings.findFirst();

  return NextResponse.json({
    isClosed: !!existing,
    existing,
    summary: {
      totalSales: parseFloat(totalSales.toFixed(2)),
      totalOrders: bills.length,
      totalExpenses: parseFloat(totalExpenses.toFixed(2)),
      netProfit: parseFloat((totalSales - totalExpenses).toFixed(2)),
      cashSales: parseFloat(cashSales.toFixed(2)),
      upiSales: parseFloat(upiSales.toFixed(2)),
      cardSales: parseFloat(cardSales.toFixed(2)),
      creditSales: parseFloat(creditSales.toFixed(2)),
      openingCash: settings?.openingCash ?? 0,
      expectedClosingCash: parseFloat(((settings?.openingCash ?? 0) + cashSales).toFixed(2)),
    },
    expenses,
  });
}

export async function POST(req: NextRequest) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const body = await req.json();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const existing = await prisma.dayClose.findFirst({
    where: { date: { gte: today, lt: tomorrow } },
  });
  if (existing) {
    return NextResponse.json({ error: "Today is already closed" }, { status: 409 });
  }

  const bills = await prisma.bill.findMany({
    where: { paymentStatus: "PAID", createdAt: { gte: today, lt: tomorrow } },
  });
  const expenses = await prisma.expense.findMany({
    where: { date: { gte: today, lt: tomorrow } },
  });

  const totalSales = bills.reduce((s, b) => s + b.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const dayClose = await prisma.dayClose.create({
    data: {
      date: today,
      openingCash: body.openingCash ?? 0,
      closingCash: body.closingCash ?? 0,
      totalSales: parseFloat(totalSales.toFixed(2)),
      totalOrders: bills.length,
      totalExpenses: parseFloat(totalExpenses.toFixed(2)),
      netProfit: parseFloat((totalSales - totalExpenses).toFixed(2)),
      cashSales: bills.filter(b => b.paymentMode === "CASH").reduce((s, b) => s + b.total, 0),
      upiSales: bills.filter(b => b.paymentMode === "UPI").reduce((s, b) => s + b.total, 0),
      cardSales: bills.filter(b => b.paymentMode === "CARD").reduce((s, b) => s + b.total, 0),
      creditSales: bills.filter(b => b.paymentMode === "CREDIT").reduce((s, b) => s + b.total, 0),
      notes: body.notes ?? null,
      closedById: session.userId,
    },
  });

  return NextResponse.json({ dayClose }, { status: 201 });
}
