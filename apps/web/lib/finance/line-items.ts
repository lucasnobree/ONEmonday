/**
 * Invoice line-item math.
 *
 * An invoice line has a description, a quantity and a unit price. To keep
 * money and quantities exact we never use floats:
 *  - `unitPriceCents` is integer cents (the Finance money invariant).
 *  - `quantityMilli` is the quantity in integer milli-units (1000 = 1.000),
 *    so fractional quantities like 1.5 h or 0.25 un stay exact integers.
 *
 * The line total is `round(quantityMilli * unitPriceCents / 1000)` and the
 * invoice amount is the integer sum of its line totals.
 */

/** A single invoice line, with quantity in milli-units and price in cents. */
export interface LineItemInput {
  description: string;
  /** Quantity in integer milli-units (1000 = 1.000). Must be > 0. */
  quantityMilli: number;
  /** Unit price in integer cents. Must be >= 0. */
  unitPriceCents: number;
}

/**
 * Computes one line's total in integer cents. Rounds half-up so that, e.g.,
 * 1.5 (quantityMilli 1500) × R$0,01 (1 cent) = 2 cents, not 1.
 * Returns 0 for non-finite or non-positive quantities.
 */
export function lineTotalCents(
  quantityMilli: number,
  unitPriceCents: number
): number {
  if (
    !Number.isFinite(quantityMilli) ||
    !Number.isFinite(unitPriceCents) ||
    quantityMilli <= 0 ||
    unitPriceCents < 0
  ) {
    return 0;
  }
  return Math.round((quantityMilli * unitPriceCents) / 1000);
}

/** Sums the line totals of a set of line items into an integer-cent amount. */
export function invoiceTotalCents(lines: LineItemInput[]): number {
  return lines.reduce(
    (total, l) => total + lineTotalCents(l.quantityMilli, l.unitPriceCents),
    0
  );
}

/** Converts a human-typed quantity (e.g. "1,5", "2") to integer milli-units. */
export function quantityToMilli(input: string): number | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().replace(",", ".");
  if (normalized === "") return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 1000);
}

/** Formats integer milli-units back to a plain decimal string for display. */
export function formatQuantity(quantityMilli: number): string {
  const value = quantityMilli / 1000;
  // Drop trailing zeros: 1000 -> "1", 1500 -> "1,5".
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}
