import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { safeHandler } from "@/lib/apiHandler";

// Sends daily report via email using a simple mailto or webhook
// For production: integrate with Resend/Nodemailer
export async function POST(req: NextRequest) {
  return safeHandler("email-report/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [bills, expenses, orders] = await Promise.all([
      prisma.bill.findMany({ where: { paymentStatus: "PAID", createdAt: { gte: today } } }),
      prisma.expense.findMany({ where: { date: { gte: today } } }),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
    ]);

    const revenue = bills.reduce((s, b) => s + b.total, 0);
    const tax = bills.reduce((s, b) => s + b.cgst + b.sgst, 0);
    const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
    const settings = await prisma.settings.findFirst();

    const report = {
      date: today.toLocaleDateString("en-IN"),
      restaurant: settings?.restaurantName ?? "Restaurant",
      revenue: revenue.toFixed(2),
      tax: tax.toFixed(2),
      expenses: expenseTotal.toFixed(2),
      profit: (revenue - expenseTotal).toFixed(2),
      orders,
      paidBills: bills.length,
    };

    // Return report data — frontend can use mailto: link or webhook
    // To integrate email: set EMAIL_WEBHOOK_URL env var pointing to n8n/Zapier webhook
    const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      return NextResponse.json({ sent: true, report });
    }

    return NextResponse.json({ sent: false, report, message: "Set EMAIL_WEBHOOK_URL in env to auto-send" });
  });
}
