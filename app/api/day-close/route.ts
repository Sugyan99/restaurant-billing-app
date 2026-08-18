import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  return safeHandler("day-close/GET", async () => {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const tid = session.tenantId;
  const { existing, bills, expenses } = await withTenant(session.tenantId, session.userId, async (tx) => {
    const existing = await tx.dayClose.findFirst({
      where: { tenantId: tid, date: { gte: today, lt: tomorrow } },
    });
    const bills = await tx.bill.findMany({
      where: { tenantId: tid, paymentStatus: "PAID", createdAt: { gte: today, lt: tomorrow } },
    });
    const expenses = await tx.expense.findMany({
      where: { tenantId: tid, date: { gte: today, lt: tomorrow } },
    });
    return { existing, bills, expenses };
  });

  const totalSales = bills.reduce((s, b) => s + b.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const cashSales = bills.filter(b => b.paymentMode === "CASH").reduce((s, b) => s + b.total, 0);
  const upiSales = bills.filter(b => b.paymentMode === "UPI").reduce((s, b) => s + b.total, 0);
  const cardSales = bills.filter(b => b.paymentMode === "CARD").reduce((s, b) => s + b.total, 0);
  const creditSales = bills.filter(b => b.paymentMode === "CREDIT").reduce((s, b) => s + b.total, 0);

  const settings = await withTenant(session.tenantId, session.userId, (tx) => tx.settings.findFirst({ where: { tenantId: tid } }));

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
});
}

export async function POST(req: NextRequest) {
  return safeHandler("day-close/POST", async () => {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const body = await req.json();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const tid2 = session.tenantId;

  const result = await withTenant(session.tenantId, session.userId, async (tx) => {
    const existing2 = await tx.dayClose.findFirst({
      where: { tenantId: tid2, date: { gte: today, lt: tomorrow } },
    });
    if (existing2) return { alreadyClosed: true } as const;

    const bills2 = await tx.bill.findMany({
      where: { tenantId: tid2, paymentStatus: "PAID", createdAt: { gte: today, lt: tomorrow } },
    });
    const expenses2 = await tx.expense.findMany({
      where: { tenantId: tid2, date: { gte: today, lt: tomorrow } },
    });

    const totalSales = bills2.reduce((s, b) => s + b.total, 0);
    const totalExpenses = expenses2.reduce((s, e) => s + e.amount, 0);

    const dayClose = await tx.dayClose.create({
      data: {
        tenantId: tid2,
        date: today,
        openingCash: body.openingCash ?? 0,
        closingCash: body.closingCash ?? 0,
        totalSales: parseFloat(totalSales.toFixed(2)),
        totalOrders: bills2.length,
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
        netProfit: parseFloat((totalSales - totalExpenses).toFixed(2)),
        cashSales: bills2.filter(b => b.paymentMode === "CASH").reduce((s, b) => s + b.total, 0),
        upiSales: bills2.filter(b => b.paymentMode === "UPI").reduce((s, b) => s + b.total, 0),
        cardSales: bills2.filter(b => b.paymentMode === "CARD").reduce((s, b) => s + b.total, 0),
        creditSales: bills2.filter(b => b.paymentMode === "CREDIT").reduce((s, b) => s + b.total, 0),
        notes: body.notes ?? null,
        closedById: session.userId,
      },
    });
    return { dayClose } as const;
  });

  if ("alreadyClosed" in result) {
    return NextResponse.json({ error: "Today is already closed" }, { status: 409 });
  }
  return NextResponse.json({ dayClose: result.dayClose }, { status: 201 });
});
}
