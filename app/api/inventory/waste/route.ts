import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";

const schema = z.object({
  inventoryItemId: z.string(),
  quantity: z.number().positive(),
  note: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return safeHandler("inventory/waste/GET", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const entries = await prisma.stockTransaction.findMany({
      where: { type: "WASTE" },
      include: { inventoryItem: { select: { name: true, unit: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ entries });
  });
}

export async function POST(req: NextRequest) {
  return safeHandler("inventory/waste/POST", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const { inventoryItemId, quantity, note } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId } });
      if (!item) throw new Error("Item not found");
      const newStock = Math.max(0, item.currentStock - quantity);
      await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentStock: newStock } });
      return tx.stockTransaction.create({
        data: {
          id: `stx_${Date.now()}`,
          inventoryItemId,
          type: "WASTE",
          quantity: -quantity,
          balanceAfter: newStock,
          note: note ?? "Waste logged",
          createdById: session.userId,
        },
        include: { inventoryItem: { select: { name: true, unit: true } } },
      });
    });
    return NextResponse.json({ entry: result }, { status: 201 });
  });
}
