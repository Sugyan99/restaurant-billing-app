import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("categories/[id]/PUT", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;

    const { id } = await params;
    const body = await req.json();

    const category = await withTenant(session.tenantId, session.userId, (tx) =>
      tx.category.update({
        where: { id },
        data: { name: body.name, sortOrder: body.sortOrder },
      })
    );

    return NextResponse.json({ category });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("categories/[id]/DELETE", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;

    const { id } = await params;

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      const itemCount = await tx.menuItem.count({ where: { categoryId: id, tenantId: session.tenantId } });
      if (itemCount > 0) return { error: true } as const;
      await tx.category.delete({ where: { id } });
      return { success: true } as const;
    });

    if ("error" in result && result.error) {
      return NextResponse.json(
        { error: "Move or delete the items in this category first" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  });
}
