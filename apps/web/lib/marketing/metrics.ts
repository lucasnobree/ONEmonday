/**
 * Pure marketing metric helpers. All monetary inputs are integer cents
 * (mirrors the Finance module money invariant); all ratios are returned
 * as percentages rounded to one decimal place.
 */

/**
 * Conversion rate: conversions as a percentage of leads.
 * Returns 0 when there are no leads (avoids division by zero).
 */
export function conversionRate(conversions: number, leads: number): number {
  if (leads <= 0) return 0;
  return Math.round((conversions / leads) * 1000) / 10;
}

/**
 * Click/lead rate: leads as a percentage of impressions.
 * Returns 0 when there are no impressions.
 */
export function leadRate(leads: number, impressions: number): number {
  if (impressions <= 0) return 0;
  return Math.round((leads / impressions) * 1000) / 10;
}

/**
 * Cost per lead in integer cents. Returns 0 when there are no leads so the
 * caller never divides by zero. Result is rounded to an integer cent.
 */
export function costPerLead(spendCents: number, leads: number): number {
  if (leads <= 0) return 0;
  return Math.round(spendCents / leads);
}

/**
 * Cost per conversion (acquisition cost) in integer cents.
 * Returns 0 when there are no conversions.
 */
export function costPerConversion(
  spendCents: number,
  conversions: number
): number {
  if (conversions <= 0) return 0;
  return Math.round(spendCents / conversions);
}

/**
 * Budget usage as a percentage (0–N), rounded to an integer.
 * Returns 0 when the budget is 0 to avoid division by zero.
 */
export function budgetUsagePercent(
  spendCents: number,
  budgetCents: number
): number {
  if (budgetCents <= 0) return 0;
  return Math.round((spendCents / budgetCents) * 100);
}

/** True when actual spend has exceeded the planned budget. */
export function isOverBudget(spendCents: number, budgetCents: number): boolean {
  return budgetCents > 0 && spendCents > budgetCents;
}
