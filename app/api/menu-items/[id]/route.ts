import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function PUT(
  req: NextRequest,
  {
  return safeHandler("menu-items/[id]/PUT", async () => { params }: { params: Promise<{ id: string }> }
) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const { id } = await params;
  const body = await req.json();

  const item = await prisma.menuItem.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      price: body.price,
      isVeg: body.isVeg,
      isAvailable: body.isAvailable,
      categoryId: body.categoryId,
    },
  });

  return NextResponse.json({ item });
});
}

export async function DELETE(
  req: NextRequest,
  {
  return safeHandler("menu-items/[id]/DELETE", async () => { params }: { params: Promise<{ id: string }> }
) {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const { id } = await params;

  // Don't hard-delete items that appear in past orders (breaks order history).
  // Instead mark unavailable. Only delete if it's never been ordered.
  const usedInOrders = await prisma.orderItem.count({ where: { menuItemId: id } });

  if (usedInOrders > 0) {
    await prisma.menuItem.update({ where: { id }, data: { isAvailable: false } });
    return NextResponse.json({
      message: "Item has past orders, so it was marked unavailable instead of deleted",
    });
  }

  await prisma.menuItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
}
