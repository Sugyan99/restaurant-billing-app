import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "today"; // today | week | month

  const now = new Date();
  let startDate: Date;

  if (type === "week") {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
  } else if (type === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    // today
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const bills = await prisma.bill.findMany({
    where: {
      paymentStatus: "PAID",
      createdAt: { gte: startDate },
    },
    include: {
      order: {
        include: {
          items: { include: { menuItem: { include: { category: true } } } },
        },
      },
    },
  });

  // Aggregate totals
  const totalRevenue = bills.reduce((sum, b) => sum + b.total, 0);
  const totalOrders = bills.length;
  const totalTax = bills.reduce((sum, b) => sum + b.cgst + b.sgst, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Payment mode breakdown
  const paymentBreakdown: Record<string, number> = {};
  for (const bill of bills) {
    const mode = bill.paymentMode ?? "UNKNOWN";
    paymentBreakdown[mode] = (paymentBreakdown[mode] ?? 0) + bill.total;
  }

  // Top selling items
  const itemSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
  for (const bill of bills) {
    for (const item of bill.order.items) {
      const name = item.menuItem.name;
      if (!itemSales[name]) {
        itemSales[name] = { name, quantity: 0, revenue: 0 };
      }
      itemSales[name].quantity += item.quantity;
      itemSales[name].revenue += item.price * item.quantity;
    }
  }
  const topItems = Object.values(itemSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // Category-wise revenue
  const categorySales: Record<string, { name: string; revenue: number }> = {};
  for (const bill of bills) {
    for (const item of bill.order.items) {
      const catName = item.menuItem.category?.name ?? "Uncategorized";
      if (!categorySales[catName]) {
        categorySales[catName] = { name: catName, revenue: 0 };
      }
      categorySales[catName].revenue += item.price * item.quantity;
    }
  }

  return NextResponse.json({
    period: type,
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalOrders,
    totalTax: parseFloat(totalTax.toFixed(2)),
    avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
    paymentBreakdown,
    topItems,
    categorySales: Object.values(categorySales),
  });
}
