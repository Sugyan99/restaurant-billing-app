import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
  force:         z.boolean().optional().default(false), // bypass duplicate check
});

export async function GET(req: NextRequest) {
  return safeHandler("orders/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const orders = await prisma.order.findMany({
      where: status ? { status: status as "PENDING"|"PREPARING"|"READY"|"SERVED"|"CANCELLED" } : {},
      include: {
        items: { include: { menuItem: true } },
        table: true,
        bill:  true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ orders });
  });
}

export async function POST(req: NextRequest) {
  return safeHandler("orders/POST", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const body   = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid order data" },
        { status: 400 }
      );
    }

    const { type, tableId, customerName, customerPhone, isPriority, kotNote, items, force } = parsed.data;

    // ── Validation ──────────────────────────────────────────────────────────
    if (type === "DINE_IN" && !tableId) {
      return NextResponse.json({ error: "Table is required for Dine-In orders" }, { status: 400 });
    }

    // Duplicate prevention: block new KOT on a table with an active order
    if (type === "DINE_IN" && tableId && !force) {
      const existingOrder = await prisma.order.findFirst({
        where: { tableId, status: { in: ["PENDING", "PREPARING", "READY"] } },
        select: { id: true, orderNumber: true },
      });
      if (existingOrder) {
        return NextResponse.json(
          {
            error: `Table already has active KOT #${existingOrder.orderNumber}. Add items to it or use force=true to create a parallel KOT.`,
            existingOrderId:     existingOrder.id,
            existingOrderNumber: existingOrder.orderNumber,
            code: "DUPLICATE_ORDER",
          },
          { status: 409 }
        );
      }
    }

    // Deduplicate items (same menuItemId → merge quantities)
    const merged = new Map<string, { menuItemId: string; quantity: number; notes?: string; kitchen?: string }>();
    for (const item of items) {
      const existing = merged.get(item.menuItemId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        merged.set(item.menuItemId, { ...item });
      }
    }
    const deduped = Array.from(merged.values());

    // Server-side price lookup — never trust client prices
    const menuItemIds = deduped.map((i) => i.menuItemId);
    const menuItems   = await prisma.menuItem.findMany({ where: { id: { in: menuItemIds } } });

    if (menuItems.length !== menuItemIds.length) {
      return NextResponse.json({ error: "One or more menu items not found" }, { status: 400 });
    }
    type MI = { id: string; name: string; price: number; taxRate: number | null; isAvailable: boolean };
    const typedMenuItems = menuItems as MI[];
    const unavailable = typedMenuItems.filter((m) => !m.isAvailable);
    if (unavailable.length > 0) {
      return NextResponse.json(
        { error: `Unavailable items: ${unavailable.map((m) => m.name).join(", ")}` },
        { status: 400 }
      );
    }

    const priceMap = new Map<string, PriceEntry>(typedMenuItems.map((m) => [m.id, { price: m.price, taxRate: m.taxRate }]));

    // ── Transaction: create order + audit log + notification ────────────────
    const order = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Verify table exists and set OCCUPIED
      if (type === "DINE_IN" && tableId) {
        const table = await tx.restaurantTable.findUnique({ where: { id: tableId } });
        if (!table) {
          throw new Error("Table not found");
        }
      }

      const created = await tx.order.create({
        data: {
          type,
          tableId:       type === "DINE_IN" ? tableId : null,
          customerName:  customerName  || null,
          customerPhone: customerPhone || null,
          isPriority:    isPriority ?? false,
          kotNote:       kotNote       || null,
          createdById:   session.userId,
          items: {
            create: deduped.map((i) => ({
              menuItemId: i.menuItemId,
              quantity:   i.quantity,
              notes:      i.notes   || null,
              kitchen:    i.kitchen || null,
              price:      priceMap.get(i.menuItemId)!.price,
              taxRate:    priceMap.get(i.menuItemId)!.taxRate,
            })),
          },
        },
        include: { items: { include: { menuItem: true } }, table: true },
      });

      if (type === "DINE_IN" && tableId) {
        await tx.restaurantTable.update({ where: { id: tableId }, data: { status: "OCCUPIED" } });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          action:   "CREATE_KOT",
          entity:   "Order",
          entityId: created.id,
          userId:   session.userId,
          meta: {
            orderNumber: created.orderNumber,
            type,
            tableId:   tableId ?? null,
            itemCount: deduped.length,
            isPriority,
            kotNote:   kotNote ?? null,
          },
        },
      });

      // Kitchen notification
      await tx.notification.create({
        data: {
          type:    "NEW_KOT",
          title:   `New KOT #${created.orderNumber}${isPriority ? " ★ PRIORITY" : ""}`,
          message: `${type === "DINE_IN" && created.table ? `Table ${created.table.number}` : type} · ${deduped.length} item(s)`,
          role:    "KITCHEN",
        },
      });

      return created;
    });

    return NextResponse.json({ order }, { status: 201 });
  });
}
