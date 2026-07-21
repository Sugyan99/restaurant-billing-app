import { PrismaClient } from "@prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CartItem = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
};

export type Cart = { items: CartItem[] };

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

// ─── In-memory idempotency lock ──────────────────────────────────────────────
// Prevents double-click from firing concurrent bill creation for same order.
// Stored in module scope — persists across requests within the same serverless
// instance. TTL of 10s handles edge case where creation failed mid-way.

const _locks = new Map<string, number>();

function acquireLock(orderId: string): boolean {
  const now = Date.now();
  const existing = _locks.get(orderId);
  if (existing && now - existing < 10_000) return false; // locked
  _locks.set(orderId, now);
  return true;
}

function releaseLock(orderId: string) {
  _locks.delete(orderId);
}

// ─── Cart operations (pure) ───────────────────────────────────────────────────

function sanitizeItem(item: CartItem): CartItem {
  const price = parseFloat(Math.max(0, item.price).toFixed(2));
  const quantity = Math.max(1, Math.floor(item.quantity));
  if (price < 0) throw new Error(`Negative price not allowed: ${item.name}`);
  return { ...item, price, quantity };
}

export function cartAddItem(cart: Cart, item: CartItem): Cart {
  const s = sanitizeItem(item);
  const idx = cart.items.findIndex(i => i.menuItemId === s.menuItemId);
  if (idx >= 0) {
    const items = [...cart.items];
    items[idx] = { ...items[idx], quantity: items[idx].quantity + s.quantity };
    return { items };
  }
  return { items: [...cart.items, s] };
}

export function cartUpdateItem(cart: Cart, menuItemId: string, quantity: number): Cart {
  if (quantity <= 0) return cartRemoveItem(cart, menuItemId);
  return {
    items: cart.items.map(i =>
      i.menuItemId === menuItemId ? { ...i, quantity: Math.max(1, Math.floor(quantity)) } : i
    ),
  };
}

export function cartRemoveItem(cart: Cart, menuItemId: string): Cart {
  return { items: cart.items.filter(i => i.menuItemId !== menuItemId) };
}

export function cartMergeDuplicates(cart: Cart): Cart {
  const map = new Map<string, CartItem>();
  for (const item of cart.items) {
    const ex = map.get(item.menuItemId);
    map.set(item.menuItemId, ex ? { ...ex, quantity: ex.quantity + item.quantity } : { ...item });
  }
  return { items: Array.from(map.values()) };
}

export function cartIsEmpty(cart: Cart): boolean {
  return cart.items.length === 0;
}

export function cartSubtotal(cart: Cart): number {
  return parseFloat(
    cart.items.filter(i => i.price >= 0 && i.quantity >= 1)
      .reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)
  );
}

// ─── Billing calculation (pure, deterministic) ────────────────────────────────

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

export function recalculateFromCart(
  cart: Cart,
  discount: number,
  cgstPercent: number,
  sgstPercent: number
): BillCalculation {
  return calculateBill(cartSubtotal(cart), discount, cgstPercent, sgstPercent);
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export async function getGSTRates(tx: Tx): Promise<{ cgstPercent: number; sgstPercent: number }> {
  const s = await tx.settings.findFirst({ select: { cgstPercent: true, sgstPercent: true } });
  return { cgstPercent: s?.cgstPercent ?? 2.5, sgstPercent: s?.sgstPercent ?? 2.5 };
}

// ─── Draft (autosave + crash recovery) ───────────────────────────────────────

/**
 * Autosave draft before committing invoice.
 * On crash/failure, draft remains and can be recovered.
 * Upsert: safe to call multiple times (live recalculation on each cart change).
 */
export async function saveDraft(
  prisma: PrismaClient,
  orderId: string,
  cart: Cart,
  calc: BillCalculation
): Promise<void> {
  await prisma.invoiceDraft.upsert({
    where: { orderId },
    create: {
      id: `draft_${orderId}`,
      orderId,
      cartSnapshot: cart.items as any,
      discount: calc.discount,
      cgstPercent: calc.cgstPercent,
      sgstPercent: calc.sgstPercent,
      subtotal: calc.subtotal,
      total: calc.total,
    },
    update: {
      cartSnapshot: cart.items as any,
      discount: calc.discount,
      subtotal: calc.subtotal,
      total: calc.total,
      updatedAt: new Date(),
    },
  });
}

/** Retrieve draft for crash recovery. Returns null if no draft exists. */
export async function getDraft(prisma: PrismaClient, orderId: string) {
  return prisma.invoiceDraft.findUnique({ where: { orderId } });
}

/** Delete draft after successful invoice creation. */
export async function clearDraft(tx: Tx, orderId: string): Promise<void> {
  await tx.invoiceDraft.deleteMany({ where: { orderId } });
}

// ─── Audit log ────────────────────────────────────────────────────────────────

export async function auditLog(
  tx: Tx,
  action: string,
  entity: string,
  entityId: string,
  userId?: string,
  meta?: Record<string, unknown>
): Promise<void> {
  await tx.auditLog.create({
    data: {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action,
      entity,
      entityId,
      userId: userId ?? null,
      meta: (meta ?? undefined) as never,
    },
  });
}

// ─── Atomic invoice creation ──────────────────────────────────────────────────

/**
 * createInvoice — fully atomic, idempotent, crash-safe:
 * 1. Acquires in-process lock (double-click protection)
 * 2. Saves draft (autosave — recoverable if transaction fails)
 * 3. Opens DB transaction:
 *    a. Checks for existing bill (duplicate prevention)
 *    b. Creates bill via upsert (race-condition safe)
 *    c. Clears draft (bill now authoritative)
 *    d. Writes audit log entry
 * 4. Releases lock
 * 5. On any failure: lock released, draft preserved for recovery
 */
export async function createInvoice(
  prisma: PrismaClient,
  orderId: string,
  calc: BillCalculation,
  cart: Cart,
  userId?: string
): Promise<{ bill: Awaited<ReturnType<typeof createBillInTx>>; created: boolean }> {
  // 1. Double-click protection
  if (!acquireLock(orderId)) {
    throw new Error("Invoice creation already in progress for this order");
  }

  try {
    // 2. Autosave draft before any DB write
    await saveDraft(prisma, orderId, cart, calc);

    // 3. Atomic transaction
    const bill = await prisma.$transaction(async (tx) => {
      // a. Check for existing bill (idempotent return)
      const existing = await tx.bill.findUnique({ where: { orderId } });
      if (existing) return existing;

      // b. Upsert (atomic — no race between check and create)
      const created = await createBillInTx(tx, orderId, calc);

      // c. Clear draft — bill is now the source of truth
      await clearDraft(tx, orderId);

      // d. Audit log
      await auditLog(tx, "BILL_CREATED", "Bill", created.id, userId, {
        orderId,
        subtotal: calc.subtotal,
        discount: calc.discount,
        total: calc.total,
      });

      return created;
    });

    return { bill, created: true };
  } catch (err) {
    // Draft preserved on failure — crash recovery possible
    throw err;
  } finally {
    // 4. Always release lock
    releaseLock(orderId);
  }
}

// ─── Bill upsert (used internally + by order auto-bill) ──────────────────────

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

// ─── Post-payment finalization ────────────────────────────────────────────────

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
      await tx.restaurantTable.update({ where: { id: bill.order.tableId }, data: { status: "FREE" } });
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
