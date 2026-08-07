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
  const { status, isPriority, kotNote, cancelRequest, cancelApprove, itemKitchens, customerName, customerPhone } = body;

  // Build update payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  // Owner-only: edit customer details
  if (customerName !== undefined) {
    if (session.role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 });
    updateData.customerName = customerName || null;
  }
  if (customerPhone !== undefined) {
    if (session.role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 });
    updateData.customerPhone = customerPhone || null;
  }

  // Priority toggle
  if (isPriority !== undefined) updateData.isPriority = Boolean(isPriority);

  // KOT note
  if (kotNote !== undefined) updateData.kotNote = kotNote ?? null;

  // Cancel request (any role can request)
  if (cancelRequest !== undefined) {
    updateData.cancelRequestedBy = session.userId;
    updateData.cancelReason = cancelRequest;
  }

  // Status change
  if (status) {
    const validStatuses = ["PENDING", "PREPARING", "READY", "SERVED", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    // Only OWNER/MANAGER can directly cancel; others must use cancelRequest
    if (status === "CANCELLED" && !cancelApprove && !["OWNER","MANAGER"].includes(session.role)) {
      return NextResponse.json({ error: "Manager approval required to cancel" }, { status: 403 });
    }
    updateData.status = status;
    // Clear cancel request on approval
    if (status === "CANCELLED") {
      updateData.cancelRequestedBy = null;
      updateData.cancelReason = null;
    }
  }

  if (Object.keys(updateData).length === 0 && !itemKitchens?.length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const order = await prisma.$transaction(async (tx) => {
    // Bulk update item kitchen tags
    if (itemKitchens?.length) {
      await Promise.all(
        itemKitchens.map(({ id: itemId, kitchen }: { id: string; kitchen: string }) =>
          tx.orderItem.update({ where: { id: itemId }, data: { kitchen } })
        )
      );
    }

    if (Object.keys(updateData).length === 0) {
      return tx.order.findUnique({
        where: { id },
        include: { table: true, items: { include: { menuItem: true } }, bill: true },
      });
    }

    const updated = await tx.order.update({
      where: { id },
      data: updateData,
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
      await tx.order.delete({ where: { id } });
      if (order.tableId) {
        const remaining = await tx.order.count({
          where: { tableId: order.tableId, status: { in: ["PENDING","PREPARING","READY"] } },
        });
        if (remaining === 0) {
          await tx.restaurantTable.update({ where: { id: order.tableId }, data: { status: "FREE" } });
        }
      }
      await tx.auditLog.create({
        data: {
          action:   "ORDER_DELETED",
          entity:   "Order",
          entityId: id,
          userId:   session.userId,
          meta:     { orderNumber: order.orderNumber, customerName: order.customerName } as never,
        },
      });
    });

    return NextResponse.json({ success: true });
  });
}
