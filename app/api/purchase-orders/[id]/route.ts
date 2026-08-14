import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { safeHandler } from "@/lib/apiHandler";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("purchase-orders/[id]/PATCH", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;
    const { status } = await req.json();
    if (!["PENDING", "ORDERED", "RECEIVED", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const tid = session.tenantId;

    return withTenant(tid, session.userId, async (tx) => {
      const po = await tx.purchaseOrder.findFirst({ where: { id, tenantId: tid }, include: { items: true } });
      if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status },
        include: { items: true },
      });

      if (status === "RECEIVED") {
        for (const poi of updated.items) {
          const invItem = await tx.inventoryItem.findFirst({
            where: { tenantId: tid, name: { equals: poi.name, mode: "insensitive" } },
          });
          if (invItem) {
            const newStock = invItem.currentStock + poi.quantity;
            await tx.inventoryItem.update({
              where: { id: invItem.id },
              data: { currentStock: newStock, costPerUnit: poi.costPerUnit > 0 ? poi.costPerUnit : invItem.costPerUnit },
            });
            await tx.stockTransaction.create({
              data: {
                id: `stx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                tenantId: tid,
                inventoryItemId: invItem.id,
                type: "PURCHASE",
                quantity: poi.quantity,
                balanceAfter: newStock,
                note: `PO received: ${updated.supplierName}`,
                referenceId: id,
                createdById: session.userId,
              },
            });
          }
        }
      }
      return NextResponse.json({ order: updated });
    });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("purchase-orders/[id]/DELETE", async () => {
    const session = requireAuth(req, ["OWNER"]);
    if (isAuthError(session)) return session;
    const { id } = await params;
    const po = await withTenant(session.tenantId, session.userId, async (tx) => {
      const existing = await tx.purchaseOrder.findFirst({ where: { id, tenantId: session.tenantId } });
      if (!existing) return null;
      await tx.purchaseOrder.delete({ where: { id } });
      return true;
    });
    if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  });
}
