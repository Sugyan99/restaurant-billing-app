import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  unit: z.string().default("kg"),
  currentStock: z.number().min(0),
  minStock: z.number().min(0),
  costPerUnit: z.number().min(0),
  category: z.string().default("General"),
  vendorId: z.string().nullable().optional(),
});

type InventoryItem = {
  id: string; name: string; unit: string; currentStock: number;
  minStock: number; costPerUnit: number; category: string;
  vendorId: string | null; updatedAt: Date;
};

export async function GET(req: NextRequest) {
  return safeHandler("inventory/GET", async () => {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const items = await prisma.inventoryItem.findMany({ orderBy: { name: "asc" }, include: { vendor: { select: { id: true, name: true } } } }) as (InventoryItem & { vendor: { id: string; name: string } | null })[];
  const lowStock = items.filter((i: InventoryItem) => i.currentStock <= i.minStock);
  return NextResponse.json({ items, lowStock });
});
}

export async function POST(req: NextRequest) {
  return safeHandler("inventory/POST", async () => {
  const session = requireAuth(req, ["OWNER", "MANAGER"]);
  if (isAuthError(session)) return session;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { vendorId, ...rest } = parsed.data;
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryItem.create({
      data: { ...rest, id: `inv_${Date.now()}`, vendorId: vendorId ?? null },
    });
    if (created.currentStock > 0) {
      await tx.stockTransaction.create({
        data: {
          id: `stx_${Date.now()}`,
          inventoryItemId: created.id,
          type: "PURCHASE",
          quantity: created.currentStock,
          balanceAfter: created.currentStock,
          note: "Initial stock",
          createdById: session.userId,
        },
      });
    }
    return created;
  });
  return NextResponse.json({ item }, { status: 201 });
});
}
