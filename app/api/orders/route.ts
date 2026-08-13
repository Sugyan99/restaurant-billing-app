import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

type PriceEntry = { price: number; taxRate: number | null };

const orderItemSchema = z.object({
  menuItemId: z.string().min(1),
  quantity:   z.number().int().positive(),
  notes:      z.string().max(200).optional(),
  kitchen:    z.string().optional(),
});

const createOrderSchema = z.object({
  type:          z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]),
  tableId:       z.string().optional(),
  customerName:  z.string().max(100).optional(),
  customerPhone: z.string().max(20).optional(),
  isPriority:    z.boolean().optional().default(false),
  kotNote:       z.string().max(300).optional(),
  items:         z.array(orderItemSchema).min(1, "At least one item required"),
  force:         z.boolean().optional().default(false),
});

export async function GET(req: NextRequest) {
  return safeHandler("orders/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const orders = await withTenant(session.tenantId, session.userId, (tx) =>
      tx.order.findMany({
        where: {
          tenantId: session.tenantId,
          ...(status ? { status: status as "PENDING"|"PREPARING"|"READY"|"SERVED"|"CANCELLED" } : {}),
        },
        include: { items: { include: { menuItem: true } }, table: true, bill: true },
        orderBy: { createdAt: "desc" }, take: 100,
      })
    );
    return NextResponse.json({ orders });
  });
}

export async function POST(req: NextRequest) {
  return safeHandler("orders/POST", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid order data" }, { status: 400 });

    const { type, tableId, customerName, customerPhone, isPriority, kotNote, items, force } = parsed.data;
    if (type === "DINE_IN" && !tableId) return NextResponse.json({ error: "Table is required for Dine-In orders" }, { status: 400 });

    const merged = new Map<string, { menuItemId: string; quantity: number; notes?: string; kitchen?: string }>();
    for (const item of items) {
      const existing = merged.get(item.menuItemId);
      if (existing) existing.quantity += item.quantity;
      else merged.set(item.menuItemId, { ...item });
    }
    const deduped = Array.from(merged.values());
    const menuItemIds = deduped.map((i) => i.menuItemId);

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      if (type === "DINE_IN" && tableId && !force) {
        const existingOrder = await tx.order.findFirst({
          where: { tableId, tenantId: session.tenantId, status: { in: ["PENDING", "PREPARING", "READY"] } },
          select: { id: true, orderNumber: true },
        });
        if (existingOrder) return { duplicate: true, existingOrder } as const;
      }

      const menuItems = await tx.menuItem.findMany({ where: { id: { in: menuItemIds }, tenantId: session.tenantId } });
      type MI = { id: string; name: string; price: number; taxRate: number | null; isAvailable: boolean };
      const typedMenuItems = menuItems as MI[];
      if (typedMenuItems.length !== menuItemIds.length) return { missingItems: true } as const;
      const unavailable = typedMenuItems.filter((m) => !m.isAvailable);
      if (unavailable.length > 0) return { unavailable: unavailable.map((m) => m.name) } as const;

      const priceMap = new Map<string, PriceEntry>(typedMenuItems.map((m) => [m.id, { price: m.price, taxRate: m.taxRate }]));
      if (type === "DINE_IN" && tableId) {
        const table = await tx.restaurantTable.findUnique({ where: { id: tableId } });
        if (!table) return { noTable: true } as const;
      }

      const created = await tx.order.create({
        data: {
          tenantId: session.tenantId, type, tableId: type === "DINE_IN" ? tableId : null,
          customerName: customerName || null, customerPhone: customerPhone || null,
          isPriority: isPriority ?? false, kotNote: kotNote || null, createdById: session.userId,
          items: { create: deduped.map((i) => ({ tenantId: session.tenantId, menuItemId: i.menuItemId, quantity: i.quantity, notes: i.notes || null, kitchen: i.kitchen || null, price: priceMap.get(i.menuItemId)!.price, taxRate: priceMap.get(i.menuItemId)!.taxRate })) },
        },
        include: { items: { include: { menuItem: true } }, table: true },
      });

      if (type === "DINE_IN" && tableId) await tx.restaurantTable.update({ where: { id: tableId }, data: { status: "OCCUPIED" } });
      await tx.auditLog.create({ data: { tenantId: session.tenantId, action: "CREATE_KOT", entity: "Order", entityId: created.id, userId: session.userId, meta: { orderNumber: created.orderNumber, type, tableId: tableId ?? null, itemCount: deduped.length, isPriority, kotNote: kotNote ?? null } as Prisma.JsonObject } });
      await tx.notification.create({ data: { tenantId: session.tenantId, type: "NEW_KOT", title: `New KOT #${created.orderNumber}${isPriority ? " ★ PRIORITY" : ""}`, message: `${type === "DINE_IN" && created.table ? `Table ${created.table.number}` : type} · ${deduped.length} item(s)`, role: "KITCHEN" } });
      return { order: created } as const;
    });

    if ("duplicate" in result && result.duplicate) return NextResponse.json({ error: `Table already has active KOT #${result.existingOrder.orderNumber}. Add items to it or use force=true to create a parallel KOT.`, existingOrderId: result.existingOrder.id, existingOrderNumber: result.existingOrder.orderNumber, code: "DUPLICATE_ORDER" }, { status: 409 });
    if ("missingItems" in result) return NextResponse.json({ error: "One or more menu items not found" }, { status: 400 });
    if ("unavailable" in result && Array.isArray(result.unavailable)) return NextResponse.json({ error: `Unavailable items: ${result.unavailable.join(", ")}` }, { status: 400 });
    if ("noTable" in result) return NextResponse.json({ error: "Table not found" }, { status: 404 });
    return NextResponse.json({ order: (result as { order: unknown }).order }, { status: 201 });
  });
}
