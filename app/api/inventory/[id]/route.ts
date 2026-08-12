import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("inventory/[id]/PUT", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;
    const body = await req.json();
    const item = await withTenant(session.tenantId, session.userId, (tx) =>
      tx.inventoryItem.update({
        where: { id },
        data: {
          name: body.name,
          unit: body.unit,
          currentStock: body.currentStock,
          minStock: body.minStock,
          costPerUnit: body.costPerUnit,
          category: body.category ?? "General",
          vendorId: body.vendorId ?? null,
          updatedAt: new Date(),
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
  return safeHandler("inventory/[id]/DELETE", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;
    await withTenant(session.tenantId, session.userId, (tx) =>
      tx.inventoryItem.delete({ where: { id } })
    );
    return NextResponse.json({ success: true });
  });
}
