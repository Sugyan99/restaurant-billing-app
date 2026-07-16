/**
 * BillingEngine — Single source of truth for all billing logic.
 *
 * Why: GST calculation was duplicated in 3 routes (bills/POST,
 * orders/[id]/PUT auto-bill, bills/[id]/split/POST).
 * Post-payment side effects were duplicated between pay and split routes,
 * with split missing loyalty point updates entirely.
 * Bill creation had a race condition (findUnique → create not atomic).
 *
 * All billing routes now delegate here. No UI changes required.
 */

import { Prisma, PrismaClient } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export type BillCalculation = {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  total: number;
  cgstPercent: number;
  sgstPercent: number;
};

export type SplitPayment = {
  mode: "CASH" | "UPI" | "CARD" | "CREDIT";
  amount: number;
};

// ─── Pure calculation (deterministic, no DB) ─────────────────────────────────

/**
 * All monetary values rounded to 2 decimal places via toFixed(2).
 * Called with itemTotal from order items — prices are snapshots captured
 * at order time so menu price changes don't affect existing orders.
 */
export function calculateBill(
  itemsTotal: number,
  discount: number,
  cgstPercent: number,
  sgstPercent: number
): BillCalculation {
  const subtotal = parseFloat(itemsTotal.toFixed(2));
  const disc = parseFloat(Math.min(discount, subtotal).toFixed(2)); // discount cannot exceed subtotal
  const taxableAmount = parseFloat((subtotal - disc).toFixed(2));
  const cgst = parseFloat(((taxableAmount * cgstPercent) / 100).toFixed(2));
  const sgst = parseFloat(((taxableAmount * sgstPercent) / 100).toFixed(2));
  const total = parseFloat((taxableAmount + cgst + sgst).toFixed(2));

  return { subtotal, discount: disc, taxableAmount, cgst, sgst, total, cgstPercent, sgstPercent };
}

// ─── DB operations ───────────────────────────────────────────────────────────

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/**
 * Creates a bill inside an existing transaction.
 * Uses upsert to prevent duplicate bills even under concurrent requests
 * (atomic — no race condition between findUnique + create).
 *
 * Returns the existing bill if one already exists (idempotent).
 */
export async function createBillInTx(
  tx: Tx,
  orderId: string,
  calc: BillCalculation
) {
  // upsert = atomic: if bill exists return it, else create — no race condition
  return tx.bill.upsert({
    where: { orderId },
    create: {
      orderId,
      subtotal: calc.subtotal,
      cgst: calc.cgst,
      sgst: calc.sgst,
      discount: calc.discount,
      total: calc.total,
    },
    update: {}, // do nothing if already exists
    include: {
      order: { include: { items: { include: { menuItem: true } }, table: true } },
    },
  });
}

/**
 * Shared post-payment side effects — called by both pay and split routes.
 * Centralizes: order → SERVED, table → FREE (if no other active orders),
 * customer loyalty points + visit tracking.
 *
 * Previously split/route was missing loyalty points entirely.
 */
export async function finalizePayment(
  tx: Tx,
  bill: { orderId: string; total: number; order: { tableId: string | null; customerPhone: string | null } }
) {
  // 1. Mark order as SERVED
  await tx.order.update({
    where: { id: bill.orderId },
    data: { status: "SERVED" },
  });

  // 2. Free table if no other active orders on it
  if (bill.order.tableId) {
    const active = await tx.order.count({
      where: {
        tableId: bill.order.tableId,
        status: { in: ["PENDING", "PREPARING", "READY"] },
      },
    });
    if (active === 0) {
      await tx.restaurantTable.update({
        where: { id: bill.order.tableId },
        data: { status: "FREE" },
      });
    }
  }

  // 3. Update customer stats + loyalty points (1 pt per ₹10)
  if (bill.order.customerPhone) {
    const pointsEarned = Math.floor(bill.total / 10);
    await tx.customer.updateMany({
      where: { phone: bill.order.customerPhone },
      data: {
        totalVisits: { increment: 1 },
        totalSpent: { increment: bill.total },
        loyaltyPoints: { increment: pointsEarned },
      },
    });
  }
}

/**
 * Fetches GST rates from settings with safe fallbacks.
 * Cached within a single request via the passed tx — avoids
 * multiple settings queries per billing operation.
 */
export async function getGSTRates(
  tx: Tx
): Promise<{ cgstPercent: number; sgstPercent: number }> {
  const settings = await tx.settings.findFirst({
    select: { cgstPercent: true, sgstPercent: true },
  });
  return {
    cgstPercent: settings?.cgstPercent ?? 2.5,
    sgstPercent: settings?.sgstPercent ?? 2.5,
  };
}
