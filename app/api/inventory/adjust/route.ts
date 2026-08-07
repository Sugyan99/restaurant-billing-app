import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";

const schema = z.object({
  inventoryItemId: z.string(),
  newStock: z.number().min(0),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return safeHandler("inventory/adjust/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const { inventoryItemId, newStock, note } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId } });
      if (!item) throw new Error("Item not found");
      const diff = newStock - item.currentStock;
      await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentStock: newStock } });
      await tx.stockTransaction.create({
        data: {
          id: `stx_${Date.now()}`,
          inventoryItemId,
          type: "ADJUST",
          quantity: diff,
          balanceAfter: newStock,
          note: note ?? `Manual adjustment: ${item.currentStock} → ${newStock}`,
          createdById: session.userId,
        },
      });
      return { ...item, currentStock: newStock };
    });
    return NextResponse.json({ item: result });
  });
}
