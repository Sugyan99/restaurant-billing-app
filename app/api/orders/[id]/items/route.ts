import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";

const addItemsSchema = z.object({
  items: z.array(z.object({
    menuItemId: z.string().min(1),
    quantity: z.number().int().positive(),
    notes: z.string().optional(),
  })).min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return safeHandler("orders/[id]/items/POST", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;
    const { id } = await params;

    const body = await req.json();
    const parsed = addItemsSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid items" }, { status: 400 });

    const menuItemIds = parsed.data.items.map((i) => i.menuItemId);

    const result = await withTenant(session.tenantId, session.userId, async (tx) => {
      const order = await tx.order.findUnique({ where: { id } });
      if (!order) return { notFound: true } as const;
      if (order.status === "SERVED" || order.status === "CANCELLED") return { completed: true } as const;

      const menuItems = await tx.menuItem.findMany({
        where: { id: { in: menuItemIds }, tenantId: session.tenantId },
      });
      const priceMap = new Map(menuItems.map((m) => [m.id, m.price]));

      const createdItems = await Promise.all(
        parsed.data.items.map((item) =>
          tx.orderItem.create({
            data: {
              tenantId: session.tenantId,
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

      return { items: createdItems } as const;
    });

    if ("notFound" in result) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if ("completed" in result) return NextResponse.json({ error: "Cannot add items to a completed or cancelled order" }, { status: 400 });
    return NextResponse.json({ items: (result as { items: unknown[] }).items }, { status: 201 });
  });
}
