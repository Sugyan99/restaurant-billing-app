import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = requireAuth(req);
  if (isAuthError(session)) return session;

  const { id } = await params;
  const body = await req.json();
  const { status } = body;

  const validStatuses = ["PENDING", "PREPARING", "READY", "SERVED", "CANCELLED"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id },
      data: { status },
      include: { table: true, items: { include: { menuItem: true } }, bill: true },
    });

    // When order is served or cancelled, free up the table
    if (
      updated.tableId &&
      (status === "SERVED" || status === "CANCELLED")
    ) {
      // Check if this table has any other active orders before freeing it
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

    return updated;
  });

  return NextResponse.json({ order });
}
