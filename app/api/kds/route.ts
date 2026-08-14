import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";
import {
  fireItemsInTx,
  activeTicketsForStation,
} from "@/lib/kotEngine";

// GET /api/kds?station=GRILL&status=SENT,PLATED
export async function GET(req: NextRequest) {
  return safeHandler("kds/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const { searchParams } = new URL(req.url);
    const station = searchParams.get("station") ?? undefined;
    const rawStatuses = searchParams.get("status");

    const statuses = rawStatuses
      ? (rawStatuses.split(",").filter((s) =>
          ["PENDING", "SENT", "PLATED"].includes(s)
        ) as ("PENDING" | "SENT" | "PLATED")[])
      : (["SENT", "PLATED"] as const);

    const tid = session.tenantId;
    const tickets = station
      ? await activeTicketsForStation(
          prisma as unknown as Parameters<typeof activeTicketsForStation>[0],
          station,
          statuses as ("PENDING" | "SENT" | "PLATED")[],
          tid
        )
      : await prisma.kotTicket.findMany({
          where: { tenantId: tid, status: { in: statuses as ("PENDING" | "SENT" | "PLATED")[] } },
          include: {
            lines: {
              where: { status: { not: "VOIDED" } },
              include: {
                orderItem: {
                  include: {
                    menuItem: {
                      select: {
                        name: true,
                        category: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
            order: {
              select: {
                orderNumber: true,
                type: true,
                isPriority: true,
                kotNote: true,
                table: { select: { number: true } },
              },
            },
          },
          orderBy: [
            { order: { isPriority: "desc" } },
            { createdAt: "asc" },
          ],
        });

    return NextResponse.json({ tickets });
  });
}

// POST /api/kds  { orderId, station, items: [{orderItemId, qty}] }
const fireSchema = z.object({
  orderId: z.string().min(1),
  station: z.string().min(1).max(50),
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        qty: z.number().int().positive(),
      })
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  return safeHandler("kds/POST", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const body = await req.json();
    const parsed = fireSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
        { status: 400 }
      );
    }

    const { orderId, station, items } = parsed.data;

    // Verify order exists and is active
    const order = await prisma.order.findUnique({
      where: { id: orderId, tenantId: session.tenantId },
      select: { status: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (["SERVED", "CANCELLED"].includes(order.status)) {
      return NextResponse.json(
        { error: "Cannot fire items on a completed order" },
        { status: 400 }
      );
    }

    await withTenant(session.tenantId, session.userId, async (tx) => {
      await fireItemsInTx(
        tx as unknown as Parameters<typeof fireItemsInTx>[0],
        orderId,
        station,
        items
      );
    });

    return NextResponse.json({ success: true }, { status: 201 });
  });
}
