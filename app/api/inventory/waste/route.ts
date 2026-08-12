import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
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
    const entries = await withTenant(session.tenantId, session.userId, (tx) =>
      tx.stockTransaction.findMany({
        where: { tenantId: session.tenantId, type: "WASTE" },
        include: { inventoryItem: { select: { name: true, unit: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    );
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

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId } });
      if (!item) return { notFound: true } as const;
      const newStock = Math.max(0, item.currentStock - quantity);
      await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentStock: newStock } });
      const entry = await tx.stockTransaction.create({
        data: {
          id: `stx_${Date.now()}`,
          tenantId: session.tenantId,
          inventoryItemId,
          type: "WASTE",
          quantity: -quantity,
          balanceAfter: newStock,
          note: note ?? "Waste logged",
          createdById: session.userId,
        },
        include: { inventoryItem: { select: { name: true, unit: true } } },
      });
      return { entry } as const;
    });

    if ("notFound" in result) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    return NextResponse.json({ entry: result.entry }, { status: 201 });
  });
}
