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

    // Auto-create bill if order is SERVED and no bill exists yet
    if (status === "SERVED" && !updated.bill) {
      const settings = await tx.settings.findFirst();
      const cgstPercent = settings?.cgstPercent ?? 2.5;
      const sgstPercent = settings?.sgstPercent ?? 2.5;

      const subtotal = updated.items.reduce(
        (sum, item) => sum + item.price * item.quantity, 0
      );
      const cgst = parseFloat(((subtotal * cgstPercent) / 100).toFixed(2));
      const sgst = parseFloat(((subtotal * sgstPercent) / 100).toFixed(2));
      const total = parseFloat((subtotal + cgst + sgst).toFixed(2));

      await tx.bill.create({
        data: { orderId: id, subtotal, cgst, sgst, discount: 0, total },
      });
    }

    return updated;
  });

  return NextResponse.json({ order });
});
}
