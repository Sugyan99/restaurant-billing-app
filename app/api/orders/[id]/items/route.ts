import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";

const addItemsSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().positive(),
        notes: z.string().optional(),
      })
    )
    .min(1),
});

export async function POST(
  req: NextRequest,
  {
  return safeHandler("orders/[id]/items/POST", async () => { params }: { params: Promise<{ id: string }> }
) {
  const session = requireAuth(req);
  if (isAuthError(session)) return session;

  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "SERVED" || order.status === "CANCELLED") {
    return NextResponse.json(
      { error: "Cannot add items to a completed or cancelled order" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = addItemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid items" }, { status: 400 });
  }

  // Get server-side prices (never trust client-submitted prices)
  const menuItemIds = parsed.data.items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
  });
  const priceMap = new Map(menuItems.map((m) => [m.id, m.price]));

  const createdItems = await prisma.$transaction(
    parsed.data.items.map((item) =>
      prisma.orderItem.create({
        data: {
          orderId: id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          notes: item.notes,
          price: priceMap.get(item.menuItemId)!,
        },
        include: { menuItem: true },
      })
    )
  );

  return NextResponse.json({ items: createdItems }, { status: 201 });
});
}
