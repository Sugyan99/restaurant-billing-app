import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { safeHandler } from "@/lib/apiHandler";

export async function GET(req: NextRequest) {
  return safeHandler("stock-ledger/GET", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;

    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const [inventory, expenses] = await Promise.all([
      prisma.inventoryItem.findMany({ orderBy: { name: "asc" } }),
      prisma.expense.findMany({
        where: { category: "INGREDIENTS", date: { gte: start, lte: end } },
        orderBy: { date: "desc" },
      }),
    ]);

    // Match expenses to inventory items by name (fuzzy)
    const ledger = inventory.map(item => {
      const related = expenses.filter(e =>
        e.description.toLowerCase().includes(item.name.toLowerCase()) ||
        item.name.toLowerCase().includes(e.description.toLowerCase().split(" ")[0])
      );
      const totalSpent = related.reduce((s, e) => s + e.amount, 0);
      return {
        id: item.id,
        name: item.name,
        unit: item.unit,
        currentStock: item.currentStock,
        minStock: item.minStock,
        costPerUnit: item.costPerUnit,
        isLow: item.currentStock <= item.minStock,
        totalSpentThisMonth: parseFloat(totalSpent.toFixed(2)),
        expenses: related.map(e => ({ id: e.id, description: e.description, amount: e.amount, date: e.date })),
        estimatedStockValue: parseFloat((item.currentStock * item.costPerUnit).toFixed(2)),
      };
    });

    const totalIngredientCost = expenses.reduce((s, e) => s + e.amount, 0);
    const totalStockValue = ledger.reduce((s, i) => s + i.estimatedStockValue, 0);
    const lowStockCount = ledger.filter(i => i.isLow).length;

    return NextResponse.json({
      month, year, ledger,
      summary: {
        totalIngredientCost: parseFloat(totalIngredientCost.toFixed(2)),
        totalStockValue: parseFloat(totalStockValue.toFixed(2)),
        lowStockCount,
        totalItems: inventory.length,
      },
    });
  });
}
