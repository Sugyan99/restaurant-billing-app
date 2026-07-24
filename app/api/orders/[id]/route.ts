import { calculateBill, createBillInTx, getGSTRates } from "@/lib/billingEngine";
import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("orders/[id]/GET", async () => {
    const session = requireAuth(req);
  if (isAuthError(session)) return session;

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { menuItem: { include: { category: true } } } },
      table: true,
      bill: true,
      createdBy: { select: { name: true, role: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json({ order
  });
});
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("orders/[id]/PUT", async () => {
    const session = requireAuth(req);
  if (isAuthError(session)) return session;

  const { id } = await params;
  const body = await req.json();
  const { status } = body;

  const validStatuses = ["PENDING", "PREPARING", "READY", "SERVED", "CANCELLED"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400
  });
}

  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id },
      data: { status },
      include: { table: true, items: { include: { menuItem: true } }, bill: true },
    });

    // Free table when served/cancelled
    if (updated.tableId && (status === "SERVED" || status === "CANCELLED")) {
      const activeOrdersOnTable = await tx.order.count({
        where: {
          tableId: updated.tableId,
          status: { in: ["PENDING", "PREPARING", "READY"] },
          id: { not: id },
        },
      });
      if (activeOrdersOnTable === 0) {
        await tx.restaurantTable.update({
          where: { id: updated.tableId },
          data: { status: "FREE" },
        });
      }
    }

    // Auto-create bill if order is SERVED — uses BillingEngine (single source of truth)
    if (status === "SERVED" && !updated.bill) {
      const { cgstPercent, sgstPercent, taxConfig } = await getGSTRates(tx);
      const itemsTotal = updated.items.reduce((s, i) => s + i.price * i.quantity, 0);
      const calc = calculateBill(itemsTotal, 0, cgstPercent, sgstPercent, taxConfig);
      await createBillInTx(tx, id, calc); // upsert — safe if bill already exists
    }

    return updated;
  });

  return NextResponse.json({ order });
});
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("orders/[id]/DELETE", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id }, include: { table: true, bill: true },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!["SERVED","CANCELLED"].includes(order.status)) {
      return NextResponse.json({ error: "Only served or cancelled orders can be deleted" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      if (order.bill) await tx.bill.delete({ where: { id: order.bill.id } });
      // orderItems cascade delete via schema onDelete: Cascade
      await tx.order.delete({ where: { id } });
      // Free table if all orders gone
      if (order.tableId) {
        const remaining = await tx.order.count({
          where: { tableId: order.tableId, status: { in: ["PENDING","PREPARING","READY"] } },
        });
        if (remaining === 0) {
          await tx.restaurantTable.update({ where: { id: order.tableId }, data: { status: "FREE" } });
        }
      }
    });

    return NextResponse.json({ success: true });
  });
}
