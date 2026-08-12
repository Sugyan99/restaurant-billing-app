import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
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

export async function GET(req: NextRequest) {
  return safeHandler("inventory/GET", async () => {
    const session = requireAuth(req, ["OWNER", "MANAGER"]);
    if (isAuthError(session)) return session;

    const items = await withTenant(session.tenantId, session.userId, (tx) =>
      tx.inventoryItem.findMany({
        where: { tenantId: session.tenantId },
        orderBy: { name: "asc" },
        include: { vendor: { select: { id: true, name: true } } },
      })
    );
    const lowStock = items.filter((i) => i.currentStock <= i.minStock);
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
    const item = await withTenant(session.tenantId, session.userId, async (tx) => {
      const created = await tx.inventoryItem.create({
        data: { ...rest, id: `inv_${Date.now()}`, tenantId: session.tenantId, vendorId: vendorId ?? null },
      });
      if (created.currentStock > 0) {
        await tx.stockTransaction.create({
          data: {
            id: `stx_${Date.now()}`,
            tenantId: session.tenantId,
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
