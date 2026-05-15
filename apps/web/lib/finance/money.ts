/**
 * Money helpers for the Finance module.
 *
 * INVARIANT: every monetary amount in this module is an INTEGER number of
 * minor units (cents / centavos). Floats are never used to represent money —
 * `0.1 + 0.2 !== 0.3` would silently corrupt totals. Conversion to/from a
 * human-facing decimal happens only at the UI boundary, through these
 * functions, and the result is always rounded to an integer.
 */

/** Currencies the Finance module supports, with their display locale. */
export const SUPPORTED_CURRENCIES = ["BRL", "USD", "EUR"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

const CURRENCY_LOCALE: Record<Currency, string> = {
  BRL: "pt-BR",
  USD: "en-US",
  EUR: "de-DE",
};

/**
 * Converts a major-unit amount (reais / dollars) to integer cents.
 * Rounds half-up to the nearest cent so `19.999` becomes `2000`, not `1999`.
 * Returns `null` for non-finite input.
 */
export function toCents(amount: number): number | null {
  if (!Number.isFinite(amount)) return null;
  // Scale, then round to kill binary-float drift before truncating.
  return Math.round(amount * 100);
}

/**
 * Parses a user-typed string (e.g. "1.234,56", "1234.56", "R$ 99") into
 * integer cents. Accepts both pt-BR ("." thousands, "," decimal) and en-US
 * ("," thousands, "." decimal) formatting. Returns `null` if not parseable
 * or if the value is negative.
 */
export function parseCents(input: string): number | null {
  if (typeof input !== "string") return null;
  // Strip everything except digits, separators and a leading sign.
  let s = input.trim().replace(/[^\d.,-]/g, "");
  if (s === "" || s === "-") return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // The right-most separator is the decimal one; the other is grouping.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // A lone comma is treated as the decimal separator (pt-BR).
    s = s.replace(",", ".");
  }

  const value = Number(s);
  if (!Number.isFinite(value) || value < 0) return null;
  return toCents(value);
}

/** Converts integer cents back to a major-unit number (for inputs/charts). */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Formats integer cents as a localized currency string.
 * `formatCents(123456, "BRL")` -> "R$ 1.234,56".
 */
export function formatCents(cents: number, currency: Currency = "BRL"): string {
  const locale = CURRENCY_LOCALE[currency] ?? "pt-BR";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(fromCents(cents));
}

/** Sums a list of integer-cent amounts. Always returns an integer. */
export function sumCents(amounts: number[]): number {
  return amounts.reduce((total, c) => total + c, 0);
}

/**
 * Budget-vs-actual usage ratio as a percentage (0–N), rounded to an integer.
 * Returns 0 when the budget is 0 to avoid division by zero.
 */
export function budgetUsagePercent(actualCents: number, budgetCents: number): number {
  if (budgetCents <= 0) return 0;
  return Math.round((actualCents / budgetCents) * 100);
}
