import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("tables/[id]/PUT", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;
    const body = await req.json();
    const table = await prisma.restaurantTable.update({
      where: { id },
      data: {
        ...(body.number !== undefined && { number: body.number }),
        ...(body.capacity !== undefined && { capacity: body.capacity }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.posX !== undefined && { posX: body.posX }),
        ...(body.posY !== undefined && { posY: body.posY }),
        ...(body.shape !== undefined && { shape: body.shape }),
        ...(body.section !== undefined && { section: body.section }),
        ...(body.mergedWith !== undefined && { mergedWith: body.mergedWith }),
      },
    });
    return NextResponse.json({ table });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("tables/[id]/DELETE", async () => {
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
