import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function PUT(
  req: NextRequest,
  {
  return safeHandler("tables/[id]/PUT", async () => { params }: { params: Promise<{ id: string }> }
) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const { id } = await params;
  const body = await req.json();

  const table = await prisma.restaurantTable.update({
    where: { id },
    data: {
      number: body.number,
      capacity: body.capacity,
      status: body.status,
    },
  });

  return NextResponse.json({ table });
});
}

export async function DELETE(
  req: NextRequest,
  {
  return safeHandler("tables/[id]/DELETE", async () => { params }: { params: Promise<{ id: string }> }
) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const { id } = await params;

  const activeOrders = await prisma.order.count({
    where: { tableId: id, status: { in: ["PENDING", "PREPARING", "READY"] } },
  });

  if (activeOrders > 0) {
    return NextResponse.json(
      { error: "This table has active orders. Complete them first." },
      { status: 400 }
    );
  }

  await prisma.restaurantTable.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
}
