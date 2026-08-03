import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";
import { advanceTicketInTx, voidItemInTx } from "@/lib/kotEngine";
import type { Prisma } from "@prisma/client";

// PATCH /api/kds/[ticketId]  { status: "PLATED" | "VOIDED" }
// GET /api/kds/[ticketId]

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  return safeHandler("kds/[ticketId]/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const { ticketId } = await params;
    const ticket = await prisma.kotTicket.findUnique({
      where: { id: ticketId },
      include: {
        lines: {
          include: {
            orderItem: {
              include: { menuItem: { select: { name: true } } },
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
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    return NextResponse.json({ ticket });
  });
}

const advanceSchema = z.object({
  status: z.enum(["SENT", "PLATED", "VOIDED"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  return safeHandler("kds/[ticketId]/PATCH", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    const { ticketId } = await params;
    const body = await req.json();
    const parsed = advanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
        { status: 400 }
      );
    }

    const { status } = parsed.data;

    // Only OWNER/MANAGER/KITCHEN can void; any authenticated role can mark PLATED
    if (status === "VOIDED" && !["OWNER", "MANAGER", "KITCHEN"].includes(session.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions to void a ticket" },
        { status: 403 }
      );
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await advanceTicketInTx(
        tx as unknown as Parameters<typeof advanceTicketInTx>[0],
        ticketId,
        status,
        session.userId
      );
    });

    return NextResponse.json({ success: true });
  });
}

// DELETE /api/kds/[ticketId]?orderItemId=xxx  — void a single item
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  return safeHandler("kds/[ticketId]/DELETE", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;

    if (!["OWNER", "MANAGER", "KITCHEN"].includes(session.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const orderItemId = searchParams.get("orderItemId");
    if (!orderItemId) {
      return NextResponse.json(
        { error: "orderItemId query param required" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await voidItemInTx(
        tx as unknown as Parameters<typeof voidItemInTx>[0],
        orderItemId,
        session.userId
      );
    });

    return NextResponse.json({ success: true });
  });
}
