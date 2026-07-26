import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { safeHandler } from "@/lib/apiHandler";

export async function GET(req: NextRequest) {
  return safeHandler("purchase-orders/GET", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const orders = await prisma.purchaseOrder.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ orders });
  });
}

export async function POST(req: NextRequest) {
  return safeHandler("purchase-orders/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const { supplierName, items, notes, expectedAt } = await req.json();
    if (!supplierName || !items?.length) return NextResponse.json({ error: "Supplier and items required" }, { status: 400 });
    const totalAmount = items.reduce((s: number, i: { quantity: number; costPerUnit: number }) => s + i.quantity * i.costPerUnit, 0);
    const po = await prisma.purchaseOrder.create({
      data: {
        id: `po_${Date.now()}`,
        supplierName,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        notes: notes ?? null,
        orderedById: session.userId,
        expectedAt: expectedAt ? new Date(expectedAt) : null,
        items: {
          create: items.map((i: { name: string; quantity: number; unit: string; costPerUnit: number }) => ({
            id: `poi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit ?? "kg",
            costPerUnit: i.costPerUnit,
            total: parseFloat((i.quantity * i.costPerUnit).toFixed(2)),
          })),
        },
      },
      include: { items: true },
    });
    return NextResponse.json({ order: po }, { status: 201 });
  });
}
