import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

    const po = await prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status },
        include: { items: true },
      });

      // Auto-increment inventory when PO is marked RECEIVED
      if (status === "RECEIVED") {
        for (const poi of updated.items) {
          const invItem = await tx.inventoryItem.findFirst({
            where: { name: { equals: poi.name, mode: "insensitive" } },
          });
          if (invItem) {
            const newStock = invItem.currentStock + poi.quantity;
            await tx.inventoryItem.update({
              where: { id: invItem.id },
              data: {
                currentStock: newStock,
                costPerUnit: poi.costPerUnit > 0 ? poi.costPerUnit : invItem.costPerUnit,
              },
            });
            await tx.stockTransaction.create({
              data: {
                id: `stx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
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
      return updated;
    });

    return NextResponse.json({ order: po });
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
    await prisma.purchaseOrder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  });
}
