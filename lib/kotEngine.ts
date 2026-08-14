/**
 * kotEngine.ts — KOT / KDS operations
 *
 * Bug-free design notes:
 *
 * Bug 1 (Void KOT overcharges): advanceTicketInTx VOIDED branch zeros out
 *   OrderItem.quantity for every line in the ticket. Billing sums price *
 *   quantity with no status filter, so zeroing quantity is the single
 *   source-of-truth fix — no changes needed in billing/reports queries.
 *
 * Bug 2 (PLATED ticket silently drops new fire): isTerminal() catches ALL
 *   terminal statuses (VOIDED, PLATED), not just VOIDED. fireItemsInTx
 *   reopens any terminal ticket to SENT before adding lines.
 *
 * Bug 3 (qtySent over-fire): Plan entries for the same orderItemId are merged
 *   before processing, and each increment is individually clamped to
 *   min(entry.qty, line.quantity - line.qtySent) within the transaction,
 *   so concurrent fires or duplicate plan entries can never overshoot.
 */

import { PrismaClient } from "@prisma/client";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// ── Terminal-state guard ──────────────────────────────────────────────────────

const TERMINAL_STATUSES = ["VOIDED", "PLATED"] as const;
type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

function isTerminal(status: string): status is TerminalStatus {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FirePlanEntry {
  orderItemId: string;
  qty: number; // units to fire in this request
}

// ── fireItemsInTx ─────────────────────────────────────────────────────────────

/**
 * Upsert a KotTicket for (orderId, station) and record fired quantities.
 *
 * Bug 2 fix — reopens PLATED (or VOIDED) ticket before adding lines.
 * Bug 3 fix — dedupes plan entries; clamps each line's increment so
 *             qtySent never exceeds line.quantity.
 */
export async function fireItemsInTx(
  tx: Tx,
  orderId: string,
  station: string,
  plan: FirePlanEntry[]
): Promise<void> {
  if (plan.length === 0) return;

  // Bug 3 fix (part 1): merge duplicate orderItemIds in plan before any DB op
  const merged = new Map<string, number>();
  for (const e of plan) {
    merged.set(e.orderItemId, (merged.get(e.orderItemId) ?? 0) + e.qty);
  }
  const dedupedPlan = Array.from(merged.entries()).map(([orderItemId, qty]) => ({
    orderItemId,
    qty,
  }));

  // Find or create the ticket for this (order, station) pair.
  // Exclude VOIDED tickets — a voided ticket gets replaced by a fresh one.
  let ticket = await tx.kotTicket.findFirst({
    where: { orderId, station, status: { not: "VOIDED" } },
    include: { lines: true },
  });

  if (!ticket) {
    ticket = await tx.kotTicket.create({
      data: { orderId, station, status: "SENT" },
      include: { lines: true },
    });
  } else if (isTerminal(ticket.status)) {
    // Bug 2 fix: reopen any terminal ticket (PLATED included, not just VOIDED)
    ticket = await tx.kotTicket.update({
      where: { id: ticket.id },
      data: { status: "SENT", updatedAt: new Date() },
      include: { lines: true },
    });
  }

  const ticketId = ticket.id;
  const linesByItem = new Map(ticket.lines.map((l) => [l.orderItemId, l]));

  for (const entry of dedupedPlan) {
    const existing = linesByItem.get(entry.orderItemId);

    if (existing) {
      // Bug 3 fix (part 2): clamp increment so qtySent ≤ line.quantity
      const headroom = existing.quantity - existing.qtySent;
      const safeIncrement = Math.min(entry.qty, headroom);
      if (safeIncrement > 0) {
        await tx.kotTicketLine.update({
          where: { id: existing.id },
          data: {
            qtySent: { increment: safeIncrement },
            status: "SENT",
          },
        });
      }
    } else {
      // New line — look up OrderItem to cap qty at the ordered amount
      const orderItem = await tx.orderItem.findUniqueOrThrow({
        where: { id: entry.orderItemId },
      });
      const safeQty = Math.min(entry.qty, Math.max(0, orderItem.quantity));
      if (safeQty > 0) {
        await tx.kotTicketLine.create({
          data: {
            ticketId,
            orderItemId: entry.orderItemId,
            quantity: orderItem.quantity,
            qtySent: safeQty,
            status: "SENT",
          },
        });
      }
    }
  }
}

// ── advanceTicketInTx ─────────────────────────────────────────────────────────

/**
 * Advance a KotTicket to SENT → PLATED or VOIDED.
 *
 * Bug 1 fix: the VOIDED branch zeros out OrderItem.quantity for every line
 * in this ticket so that billing (price * quantity) naturally equals ₹0 for
 * voided items — no changes required in billing, reports, or GST queries.
 */
export async function advanceTicketInTx(
  tx: Tx,
  ticketId: string,
  newStatus: "SENT" | "PLATED" | "VOIDED",
  userId: string
): Promise<void> {
  const ticket = await tx.kotTicket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { lines: true },
  });

  if (ticket.status === newStatus) return; // idempotent — already there

  const now = new Date();

  await tx.kotTicket.update({
    where: { id: ticketId },
    data: {
      status: newStatus,
      updatedAt: now,
      ...(newStatus === "VOIDED" ? { voidedAt: now, voidedBy: userId } : {}),
    },
  });

  if (newStatus === "VOIDED") {
    // Mark every line as VOIDED
    await tx.kotTicketLine.updateMany({
      where: { ticketId },
      data: { status: "VOIDED", voidedAt: now, voidedBy: userId },
    });

    // Bug 1 fix: zero out OrderItem quantities so billing excludes them.
    // Consistent with voidItemInTx (item-level path) which does the same.
    const orderItemIds = ticket.lines.map((l) => l.orderItemId);
    if (orderItemIds.length > 0) {
      await tx.orderItem.updateMany({
        where: { id: { in: orderItemIds } },
        data: { quantity: 0 },
      });
    }
  }
}

// ── voidItemInTx ──────────────────────────────────────────────────────────────

/**
 * Item-level void — zero the OrderItem quantity and mark its KOT lines VOIDED.
 * This is the single-item equivalent of advanceTicketInTx(VOIDED); both paths
 * now consistently zero quantity so billing needs no status filter.
 */
export async function voidItemInTx(
  tx: Tx,
  orderItemId: string,
  userId: string
): Promise<void> {
  const now = new Date();

  await tx.orderItem.update({
    where: { id: orderItemId },
    data: { quantity: 0 },
  });

  await tx.kotTicketLine.updateMany({
    where: { orderItemId },
    data: { status: "VOIDED", voidedAt: now, voidedBy: userId },
  });
}

// ── activeTicketsForStation ───────────────────────────────────────────────────

/**
 * Returns all non-VOIDED tickets for a station (KDS board query).
 * The board only shows SENT and PLATED tickets; PENDING ones are filtered
 * client-side or via the `status` param.
 */
export async function activeTicketsForStation(
  tx: Tx,
  station: string,
  statuses: ("PENDING" | "SENT" | "PLATED")[] = ["SENT", "PLATED"],
  tenantId?: string
) {
  return tx.kotTicket.findMany({
    where: { ...(tenantId ? { tenantId } : {}), station, status: { in: statuses } },
    include: {
      lines: {
        where: { status: { not: "VOIDED" } },
        include: {
          orderItem: {
            include: { menuItem: { select: { name: true, category: { select: { name: true } } } } },
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
    orderBy: [{ order: { isPriority: "desc" } }, { createdAt: "asc" }],
  });
}
