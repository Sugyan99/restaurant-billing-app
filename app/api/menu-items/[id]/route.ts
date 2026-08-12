import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("menu-items/[id]/PUT", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;

    const { id } = await params;
    const body = await req.json();

    const item = await withTenant(session.tenantId, session.userId, (tx) =>
      tx.menuItem.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
          price: body.price,
          isVeg: body.isVeg,
          isAvailable: body.isAvailable,
          categoryId: body.categoryId,
        },
      })
    );

    return NextResponse.json({ item });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("menu-items/[id]/DELETE", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;

    const { id } = await params;

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      const usedInOrders = await tx.orderItem.count({ where: { menuItemId: id, tenantId: session.tenantId } });
      if (usedInOrders > 0) {
        await tx.menuItem.update({ where: { id }, data: { isAvailable: false } });
        return { softDeleted: true } as const;
      }
      await tx.menuItem.delete({ where: { id } });
      return { success: true } as const;
    });

    if ("softDeleted" in result) {
      return NextResponse.json({
        message: "Item has past orders, so it was marked unavailable instead of deleted",
      });
    }
    return NextResponse.json({ success: true });
  });
}
