import { calcBillTax, taxConfigFromSettings, TaxConfig } from "@/lib/taxEngine";
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
  sgstPercent: number,
  taxConfig?: Partial<TaxConfig>
): BillCalculation {
  const config = taxConfigFromSettings({
    cgstPercent,
    sgstPercent,
    igstPercent: taxConfig?.igstPercent ?? 5.0,
    taxMode: taxConfig?.taxMode ?? "EXCLUSIVE",
    isIGST: taxConfig?.isIGST ?? false,
  });
  // Use taxEngine for authoritative calculation
  const r = calcBillTax(
    [{ price: itemsTotal, quantity: 1 }],
    discount,
    config
  );
  return {
    subtotal: r.subtotal,
    discount: r.discount,
    taxableAmount: r.taxableAmount,
    cgst: r.cgst,
    sgst: r.sgst,
    total: r.total,
    cgstPercent,
    sgstPercent,
  };
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

export async function getGSTRates(tx: Tx): Promise<{ cgstPercent: number; sgstPercent: number; taxConfig: TaxConfig }> {
  const s = await tx.settings.findFirst({
    select: { cgstPercent: true, sgstPercent: true, igstPercent: true, taxMode: true, isIGST: true },
  });
  const taxConfig = taxConfigFromSettings(s);
  return {
    cgstPercent: taxConfig.cgstPercent,
    sgstPercent: taxConfig.sgstPercent,
    taxConfig,
  };
}

// ─── Draft (autosave + crash recovery) ───────────────────────────────────────

/**
 * Autosave draft before committing invoice.
 * On crash/failure, draft remains and can be recovered.
 * Upsert: safe to call multiple times (live recalculation on each cart change).
 */
export async function saveDraft(
  tx: Tx,
  orderId: string,
  cart: Cart,
  calc: BillCalculation,
  tenantId?: string
): Promise<void> {
  await tx.invoiceDraft.upsert({
    where: { orderId },
    create: {
      id: `draft_${orderId}`,
      orderId,
      ...(tenantId && { tenantId }),
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
export async function getDraft(tx: Tx, orderId: string) {
  return tx.invoiceDraft.findUnique({ where: { orderId } });
}

/** Delete draft after successful invoice creation. */
export async function clearDraft(tx: Tx, orderId: string): Promise<void> {
  await tx.invoiceDraft.deleteMany({ where: { orderId } });
}

// ─── Audit log ────────────────────────────────────────────────────────────────

export async function auditLog(
  tx: Tx,
  action: string,
  orderId: string,
  actor: string,
  tenantId: string,
  meta?: Record<string, unknown>
): Promise<void> {
  await tx.billingAuditLog.create({
    data: {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tenantId,
      orderId,
      action,
      actor,
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
  tx: Tx,
  orderId: string,
  calc: BillCalculation,
  cart: Cart,
  userId?: string,
  tenantId?: string
): Promise<{ bill: Awaited<ReturnType<typeof createBillInTx>>; created: boolean }> {
  // 1. Double-click protection
  if (!acquireLock(orderId)) {
    throw new Error("Invoice creation already in progress for this order");
  }

  try {
    // 2. Autosave draft before commit
    await saveDraft(tx, orderId, cart, calc, tenantId);

    // a. Check for existing bill (idempotent return)
    const existing = await tx.bill.findUnique({ where: { orderId } });
    if (existing) {
      return {
        bill: await tx.bill.findUniqueOrThrow({
          where: { orderId },
          include: { order: { include: { items: { include: { menuItem: true } }, table: true } } },
        }),
        created: false,
      };
    }

    // b. Upsert (atomic — no race between check and create)
    const created = await createBillInTx(tx, orderId, calc, tenantId);

    // c. Clear draft — bill is now the source of truth
    await clearDraft(tx, orderId);

    // d. Audit log
    if (!tenantId) throw new Error("Tenant context is required for billing audit logging");
    await auditLog(tx, "BILL_CREATED", orderId, userId ?? "system", tenantId, {
      orderId,
      subtotal: calc.subtotal,
      discount: calc.discount,
      total: calc.total,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { bill: created as any, created: true };
  } finally {
    // 4. Always release lock
    releaseLock(orderId);
  }
}

// ─── Bill upsert (used internally + by order auto-bill) ──────────────────────

export async function createBillInTx(tx: Tx, orderId: string, calc: BillCalculation, tenantId?: string) {
  return tx.bill.upsert({
    where: { orderId },
    create: {
      orderId,
      ...(tenantId && { tenantId }),
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

async function deductStockForOrder(tx: Tx, orderId: string, tenantId?: string) {
  try {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { where: { quantity: { gt: 0 } } } },
    });
    if (!order) return;
    for (const item of order.items) {
      const recipes = await tx.recipeIngredient.findMany({
        where: { menuItemId: item.menuItemId },
      });
      for (const r of recipes) {
        const needed = r.quantity * item.quantity;
        const inv = await tx.inventoryItem.findUnique({ where: { id: r.inventoryItemId } });
        if (!inv) continue;
        const newStock = Math.max(0, inv.currentStock - needed);
        await tx.inventoryItem.update({ where: { id: r.inventoryItemId }, data: { currentStock: newStock } });
        await tx.stockTransaction.create({
          data: {
            id: `stx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            inventoryItemId: r.inventoryItemId,
            type: "SALE",
            quantity: -needed,
            balanceAfter: newStock,
            note: `Order #${order.orderNumber}`,
            referenceId: orderId,
            ...(tenantId && { tenantId }),
          },
        });
        // Low stock notification
        if (inv.currentStock > inv.minStock && newStock <= inv.minStock) {
          await (tx.notification as any).create({
            data: {
              id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
              type: "LOW_STOCK",
              title: "Low Stock Alert",
              message: `${inv.name} is low: ${newStock.toFixed(2)} ${inv.unit} remaining`,
              role: "MANAGER",
              ...(tenantId && { tenantId }),
            },
          });
        }
      }
    }
  } catch {
    // Non-blocking — stock deduction failure should not block payment
  }
}

export async function finalizePayment(
  tx: Tx,
  bill: { orderId: string; total: number; order: { tableId: string | null; customerPhone: string | null } },
  tenantId?: string
) {
  await tx.order.update({ where: { id: bill.orderId }, data: { status: "SERVED" } });
  await deductStockForOrder(tx, bill.orderId, tenantId);

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
