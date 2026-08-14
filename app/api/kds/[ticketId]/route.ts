import { safeHandler } from "@/lib/apiHandler";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/requireAuth";
import { z } from "zod";
import { advanceTicketInTx, voidItemInTx } from "@/lib/kotEngine";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  return safeHandler("kds/[ticketId]/GET", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;
    const { ticketId } = await params;

    return withTenant(session.tenantId, session.userId, async (tx) => {
      const ticket = await tx.kotTicket.findFirst({
        where: { id: ticketId, tenantId: session.tenantId },
        include: {
          lines: { include: { orderItem: { include: { menuItem: { select: { name: true } } } } } },
          order: { select: { orderNumber: true, type: true, isPriority: true, kotNote: true, table: { select: { number: true } } } },
        },
      });
      if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      return NextResponse.json({ ticket });
    });
  });
}

const advanceSchema = z.object({ status: z.enum(["SENT", "PLATED", "VOIDED"]) });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  return safeHandler("kds/[ticketId]/PATCH", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;
    const { ticketId } = await params;
    const parsed = advanceSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    const { status } = parsed.data;

    if (status === "VOIDED" && !["OWNER", "MANAGER", "KITCHEN"].includes(session.role)) {
      return NextResponse.json({ error: "Insufficient permissions to void a ticket" }, { status: 403 });
    }

    await withTenant(session.tenantId, session.userId, async (tx) => {
      await advanceTicketInTx(tx as unknown as Parameters<typeof advanceTicketInTx>[0], ticketId, status, session.userId);
    });
    return NextResponse.json({ success: true });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  return safeHandler("kds/[ticketId]/DELETE", async () => {
    const session = requireAuth(req);
    if (isAuthError(session)) return session;
    if (!["OWNER", "MANAGER", "KITCHEN"].includes(session.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    const orderItemId = new URL(req.url).searchParams.get("orderItemId");
    if (!orderItemId) return NextResponse.json({ error: "orderItemId query param required" }, { status: 400 });

    await withTenant(session.tenantId, session.userId, async (tx) => {
      await voidItemInTx(tx as unknown as Parameters<typeof voidItemInTx>[0], orderItemId, session.userId);
    });
    return NextResponse.json({ success: true });
  });
}
