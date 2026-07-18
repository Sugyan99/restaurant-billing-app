import { PrismaClient } from "@prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CartItem = {
  menuItemId: string;
  name: string;
  price: number;       // must be >= 0
  quantity: number;    // must be >= 1
  notes?: string;
};

export type Cart = {
  items: CartItem[];
};

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

// ─── Cart Engine (pure, no DB) ────────────────────────────────────────────────

/** Validates and sanitizes a single cart item. Throws on invalid input. */
function sanitizeItem(item: CartItem): CartItem {
  const price = parseFloat(item.price.toFixed(2));
  const quantity = Math.floor(item.quantity);
  if (price < 0) throw new Error(`Item "${item.name}" has negative price`);
  if (quantity < 1) throw new Error(`Item "${item.name}" must have quantity >= 1`);
  return { ...item, price, quantity };
}

/**
 * Add item to cart. If item with same menuItemId exists, merge (sum quantities).
 * Prevents negative price and quantity < 1.
 */
export function cartAddItem(cart: Cart, item: CartItem): Cart {
  const sanitized = sanitizeItem(item);
  const existing = cart.items.findIndex(i => i.menuItemId === sanitized.menuItemId);
  if (existing >= 0) {
    const merged = [...cart.items];
    merged[existing] = {
      ...merged[existing],
      quantity: merged[existing].quantity + sanitized.quantity,
    };
    return { items: merged };
  }
  return { items: [...cart.items, sanitized] };
}

/**
 * Update item quantity. If quantity <= 0, removes the item.
 * Prevents negative quantity silently (removes instead of erroring).
 */
export function cartUpdateItem(cart: Cart, menuItemId: string, quantity: number): Cart {
  if (quantity <= 0) return cartRemoveItem(cart, menuItemId);
  return {
    items: cart.items.map(i =>
      i.menuItemId === menuItemId
        ? { ...i, quantity: Math.max(1, Math.floor(quantity)) }
        : i
    ),
  };
}

/** Remove item from cart by menuItemId. */
export function cartRemoveItem(cart: Cart, menuItemId: string): Cart {
  return { items: cart.items.filter(i => i.menuItemId !== menuItemId) };
}

/**
 * Merge duplicate items by menuItemId (sum quantities).
 * Prices are NOT averaged — first occurrence price wins (consistent with
 * price-snapshot-at-order-time rule).
 */
export function cartMergeDuplicates(cart: Cart): Cart {
  const map = new Map<string, CartItem>();
  for (const item of cart.items) {
    if (map.has(item.menuItemId)) {
      const existing = map.get(item.menuItemId)!;
      map.set(item.menuItemId, { ...existing, quantity: existing.quantity + item.quantity });
    } else {
      map.set(item.menuItemId, { ...item });
    }
  }
  return { items: Array.from(map.values()) };
}

/** Returns true if cart is empty. */
export function cartIsEmpty(cart: Cart): boolean {
  return cart.items.length === 0;
}

// ─── Billing Calculation (pure, deterministic) ────────────────────────────────

/**
 * Compute subtotal from cart items. Price and quantity validated.
 * Negative price items are skipped (defensive — should be caught at add time).
 */
export function cartSubtotal(cart: Cart): number {
  return parseFloat(
    cart.items
      .filter(i => i.price >= 0 && i.quantity >= 1)
      .reduce((s, i) => s + i.price * i.quantity, 0)
      .toFixed(2)
  );
}

/**
 * Full bill calculation from cart + rates.
 * - discount capped at subtotal (cannot go negative)
 * - all values rounded to 2 dp
 * - deterministic: same inputs always produce same outputs
 */
export function calculateBill(
  itemsTotal: number,
  discount: number,
  cgstPercent: number,
  sgstPercent: number
): BillCalculation {
  const subtotal = parseFloat(Math.max(0, itemsTotal).toFixed(2));
  const disc = parseFloat(Math.min(Math.max(0, discount), subtotal).toFixed(2));
  const taxableAmount = parseFloat((subtotal - disc).toFixed(2));
  const cgst = parseFloat(((taxableAmount * Math.max(0, cgstPercent)) / 100).toFixed(2));
  const sgst = parseFloat(((taxableAmount * Math.max(0, sgstPercent)) / 100).toFixed(2));
  const total = parseFloat((taxableAmount + cgst + sgst).toFixed(2));
  return { subtotal, discount: disc, taxableAmount, cgst, sgst, total, cgstPercent, sgstPercent };
}

/**
 * Recalculate bill from a live cart. Convenience wrapper used by
 * frontend state and order preview — keeps cart + billing in sync.
 */
export function recalculateFromCart(
  cart: Cart,
  discount: number,
  cgstPercent: number,
  sgstPercent: number
): BillCalculation {
  const subtotal = cartSubtotal(cart);
  return calculateBill(subtotal, discount, cgstPercent, sgstPercent);
}

// ─── DB operations ────────────────────────────────────────────────────────────

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/** Atomic upsert — prevents duplicate bill even under concurrent requests. */
export async function createBillInTx(tx: Tx, orderId: string, calc: BillCalculation) {
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
    update: {},
    include: {
      order: { include: { items: { include: { menuItem: true } }, table: true } },
    },
  });
}

/** Shared post-payment side effects: SERVED + table FREE + loyalty pts. */
export async function finalizePayment(
  tx: Tx,
  bill: { orderId: string; total: number; order: { tableId: string | null; customerPhone: string | null } }
) {
  await tx.order.update({ where: { id: bill.orderId }, data: { status: "SERVED" } });

  if (bill.order.tableId) {
    const active = await tx.order.count({
      where: { tableId: bill.order.tableId, status: { in: ["PENDING", "PREPARING", "READY"] } },
    });
    if (active === 0) {
      await tx.restaurantTable.update({
        where: { id: bill.order.tableId },
        data: { status: "FREE" },
      });
    }
  }

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

/** GST rates from settings with fallback. */
export async function getGSTRates(tx: Tx): Promise<{ cgstPercent: number; sgstPercent: number }> {
  const s = await tx.settings.findFirst({ select: { cgstPercent: true, sgstPercent: true } });
  return { cgstPercent: s?.cgstPercent ?? 2.5, sgstPercent: s?.sgstPercent ?? 2.5 };
}
