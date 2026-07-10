import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";

const orderItemSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
});

const createOrderSchema = z.object({
  type: z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]),
  tableId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  items: z.array(orderItemSchema).min(1, "Order must have at least one item"),
});

export async function GET(req: NextRequest) {
  const session = requireAuth(req);
  if (isAuthError(session)) return session;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const orders = await prisma.order.findMany({
    where: status ? { status: status as "PENDING" | "PREPARING" | "READY" | "SERVED" | "CANCELLED" } : {},
    include: {
      items: { include: { menuItem: true } },
      table: true,
      bill: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const session = requireAuth(req);
  if (isAuthError(session)) return session;

  const body = await req.json();
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid order data" },
      { status: 400 }
    );
  }

  const { type, tableId, customerName, customerPhone, items } = parsed.data;

  if (type === "DINE_IN" && !tableId) {
    return NextResponse.json(
      { error: "Table is required for dine-in orders" },
      { status: 400 }
    );
  }

  // Look up current prices for each menu item server-side — never trust prices
  // sent from the client, otherwise someone could submit a fake cheap price
  const menuItemIds = items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
  });

  if (menuItems.length !== menuItemIds.length) {
    return NextResponse.json({ error: "One or more menu items not found" }, { status: 400 });
  }

  const unavailable = menuItems.filter((m) => !m.isAvailable);
  if (unavailable.length > 0) {
    return NextResponse.json(
      { error: `These items are currently unavailable: ${unavailable.map((m) => m.name).join(", ")}` },
      { status: 400 }
    );
  }

  const priceMap = new Map(menuItems.map((m) => [m.id, m.price]));

  // Transaction: create the order + mark table occupied together, so if one
  // fails, neither happens (keeps data consistent)
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        type,
        tableId: type === "DINE_IN" ? tableId : null,
        customerName,
        customerPhone,
        createdById: session.userId,
        items: {
          create: items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            notes: i.notes,
            price: priceMap.get(i.menuItemId)!,
          })),
        },
      },
      include: { items: { include: { menuItem: true } }, table: true },
    });

    if (type === "DINE_IN" && tableId) {
      await tx.restaurantTable.update({
        where: { id: tableId },
        data: { status: "OCCUPIED" },
      });
    }

    return created;
  });

  return NextResponse.json({ order }, { status: 201 });
}
