/**
 * TaxEngine — handles all GST tax scenarios:
 * - GST Exclusive (tax added on top of price) — default restaurant
 * - GST Inclusive (tax extracted from price)
 * - CGST + SGST (intra-state) or IGST (inter-state)
 * - Per-item tax rate override (e.g. 5% for food, 18% for alcohol)
 * - Per-bill tax aggregation
 * - Auto calculation from settings
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type TaxMode = "EXCLUSIVE" | "INCLUSIVE";

export type TaxConfig = {
  cgstPercent: number;   // e.g. 2.5
  sgstPercent: number;   // e.g. 2.5
  igstPercent: number;   // e.g. 5.0
  taxMode: TaxMode;      // EXCLUSIVE = tax on top | INCLUSIVE = tax within price
  isIGST: boolean;       // false = CGST+SGST, true = IGST only
};

export type ItemTaxInput = {
  price: number;
  quantity: number;
  taxRate?: number | null; // per-item override; null = use restaurant default
};

export type ItemTaxResult = {
  basePrice: number;       // price before tax (exclusive) or extracted (inclusive)
  lineTotal: number;       // basePrice * quantity
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  totalWithTax: number;
  effectiveTaxRate: number;
};

export type BillTaxResult = {
  subtotal: number;        // sum of all lineTotal (base prices)
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  total: number;
  taxMode: TaxMode;
  isIGST: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const r2 = (n: number) => parseFloat(n.toFixed(2));

/** Returns effective total rate for an item given config */
function effectiveRate(config: TaxConfig, itemTaxRate?: number | null): number {
  if (itemTaxRate != null && itemTaxRate >= 0) return itemTaxRate;
  return config.isIGST
    ? config.igstPercent
    : config.cgstPercent + config.sgstPercent;
}

// ─── Per-Item Tax Calculation ─────────────────────────────────────────────────

/**
 * Calculate tax for a single line item.
 *
 * EXCLUSIVE: basePrice = price, tax added on top
 *   totalWithTax = price × qty + tax
 *
 * INCLUSIVE: tax is embedded in price, extract it
 *   basePrice = price / (1 + rate/100)
 *   tax = price - basePrice
 */
export function calcItemTax(item: ItemTaxInput, config: TaxConfig): ItemTaxResult {
  const qty = Math.max(1, Math.floor(item.quantity));
  const rate = effectiveRate(config, item.taxRate);
  const totalRate = Math.max(0, rate);

  let basePrice: number;
  let taxableAmount: number;

  if (config.taxMode === "INCLUSIVE") {
    // Extract base from inclusive price
    basePrice = r2(item.price / (1 + totalRate / 100));
    taxableAmount = r2(basePrice * qty);
  } else {
    basePrice = r2(Math.max(0, item.price));
    taxableAmount = r2(basePrice * qty);
  }

  const lineTotal = r2(basePrice * qty);

  let cgst = 0, sgst = 0, igst = 0;
  if (config.isIGST) {
    igst = r2((taxableAmount * config.igstPercent) / 100);
  } else {
    cgst = r2((taxableAmount * config.cgstPercent) / 100);
    sgst = r2((taxableAmount * config.sgstPercent) / 100);
  }

  const totalTax = r2(cgst + sgst + igst);
  const totalWithTax = r2(lineTotal + totalTax);
  const effectiveTaxRate = rate;

  return { basePrice, lineTotal, taxableAmount, cgst, sgst, igst, totalTax, totalWithTax, effectiveTaxRate };
}

// ─── Per-Bill Tax Aggregation ─────────────────────────────────────────────────

/**
 * Aggregate tax across all items, apply discount, return bill totals.
 * Discount applied to taxable amount before tax calculation.
 */
export function calcBillTax(
  items: ItemTaxInput[],
  discount: number,
  config: TaxConfig
): BillTaxResult {
  // Sum base prices from all items
  const subtotal = r2(
    items.reduce((s, item) => s + calcItemTax(item, config).lineTotal, 0)
  );

  const disc = r2(Math.min(Math.max(0, discount), subtotal));
  const taxableAmount = r2(subtotal - disc);

  let cgst = 0, sgst = 0, igst = 0;

  if (config.isIGST) {
    // IGST: single rate, inter-state
    igst = r2((taxableAmount * Math.max(0, config.igstPercent)) / 100);
  } else {
    // CGST + SGST: intra-state (split equally or per config)
    cgst = r2((taxableAmount * Math.max(0, config.cgstPercent)) / 100);
    sgst = r2((taxableAmount * Math.max(0, config.sgstPercent)) / 100);
  }

  const totalTax = r2(cgst + sgst + igst);
  const total = r2(taxableAmount + totalTax);

  return {
    subtotal,
    discount: disc,
    taxableAmount,
    cgst,
    sgst,
    igst,
    totalTax,
    total,
    taxMode: config.taxMode,
    isIGST: config.isIGST,
  };
}

// ─── Auto tax from settings ───────────────────────────────────────────────────

/** Build TaxConfig from Settings row (with safe defaults). */
export function taxConfigFromSettings(settings: {
  cgstPercent?: number | null;
  sgstPercent?: number | null;
  igstPercent?: number | null;
  taxMode?: string | null;
  isIGST?: boolean | null;
} | null): TaxConfig {
  return {
    cgstPercent: settings?.cgstPercent ?? 2.5,
    sgstPercent: settings?.sgstPercent ?? 2.5,
    igstPercent: settings?.igstPercent ?? 5.0,
    taxMode: (settings?.taxMode as TaxMode) ?? "EXCLUSIVE",
    isIGST: settings?.isIGST ?? false,
  };
}

/** GST rate display string for receipt (e.g. "CGST 2.5% + SGST 2.5%" or "IGST 5%") */
export function taxLabel(config: TaxConfig): string {
  if (config.isIGST) return `IGST ${config.igstPercent}%`;
  return `CGST ${config.cgstPercent}% + SGST ${config.sgstPercent}%`;
}
