import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  return safeHandler("reports/GET", async () => {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const { searchParams } = new URL(req.url);
  const type     = searchParams.get("type") ?? "today";
  const fromParam = searchParams.get("from");
  const toParam   = searchParams.get("to");
  const exportCsv = searchParams.get("export") === "csv";

  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  if (fromParam && toParam) {
    startDate = new Date(fromParam);
    endDate   = new Date(toParam);
    endDate.setHours(23, 59, 59, 999);
  } else if (type === "week") {
    startDate = new Date(now); startDate.setDate(now.getDate() - 7);
  } else if (type === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (type === "yesterday") {
    const y = new Date(now); y.setDate(now.getDate() - 1);
    startDate = new Date(y.getFullYear(), y.getMonth(), y.getDate());
    endDate   = new Date(startDate); endDate.setHours(23, 59, 59, 999);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const bills = await withTenant(session.tenantId, session.userId, (tx) => tx.bill.findMany({
    where: { tenantId: session.tenantId, paymentStatus: "PAID", createdAt: { gte: startDate, lte: endDate } },
    include: {
      order: { include: { items: { include: { menuItem: { include: { category: true } } } } } },
    },
  }));

  const totalRevenue    = bills.reduce((s, b) => s + b.total, 0);
  const totalOrders     = bills.length;
  const totalTax        = bills.reduce((s, b) => s + b.cgst + b.sgst, 0);
  const avgOrderValue   = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const paymentBreakdown: Record<string, number> = {};
  for (const b of bills) {
    const mode = b.paymentMode ?? "UNKNOWN";
    paymentBreakdown[mode] = (paymentBreakdown[mode] ?? 0) + b.total;
  }

  const itemSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
  const categorySalesMap: Record<string, { name: string; revenue: number }> = {};
  for (const b of bills) {
    for (const item of b.order.items) {
      const name = item.menuItem.name;
      if (!itemSales[name]) itemSales[name] = { name, quantity: 0, revenue: 0 };
      itemSales[name].quantity += item.quantity;
      itemSales[name].revenue  += item.price * item.quantity;
      const cat = item.menuItem.category?.name ?? "Uncategorized";
      if (!categorySalesMap[cat]) categorySalesMap[cat] = { name: cat, revenue: 0 };
      categorySalesMap[cat].revenue += item.price * item.quantity;
    }
  }

  const topItems      = Object.values(itemSales).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  const categorySales = Object.values(categorySalesMap);

  if (exportCsv) {
    const rows = ["Bill#,Date,Payment,Subtotal,Tax,Total"];
    for (const b of bills) {
      rows.push(`${b.billNumber},${b.createdAt.toISOString().slice(0,10)},${b.paymentMode ?? ""},${b.subtotal.toFixed(2)},${(b.cgst+b.sgst).toFixed(2)},${b.total.toFixed(2)}`);
    }
    return new NextResponse(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="sales-report-${type}.csv"`,
      },
    });
  }

  return NextResponse.json({
    period: fromParam ? "custom" : type,
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalOrders,
    totalTax:       parseFloat(totalTax.toFixed(2)),
    avgOrderValue:  parseFloat(avgOrderValue.toFixed(2)),
    paymentBreakdown,
    topItems,
    categorySales,
  });
});
}
