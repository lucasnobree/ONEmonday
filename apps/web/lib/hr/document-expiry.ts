/**
 * Pure helpers for HR document expiry status.
 * Kept framework-free so they can be unit tested in isolation.
 */

export type ExpiryStatus = "none" | "valid" | "expiring" | "expired";

/** Number of days before the expiry date at which a document is "expiring soon". */
export const EXPIRY_SOON_DAYS = 30;

/**
 * Whole days from `from` until `expiryDate` (negative once expired).
 * Both dates are compared at day granularity in UTC.
 */
export function daysUntilExpiry(
  expiryDate: string | null | undefined,
  from: Date = new Date()
): number | null {
  if (!expiryDate) return null;
  const expiry = Date.parse(`${expiryDate}T00:00:00Z`);
  if (Number.isNaN(expiry)) return null;
  const today = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate()
  );
  return Math.round((expiry - today) / 86_400_000);
}

/**
 * Classify a document by its expiry date.
 * - `none`     — no expiry tracked
 * - `expired`  — expiry date is in the past
 * - `expiring` — expires within EXPIRY_SOON_DAYS
 * - `valid`    — expires further out
 */
export function getExpiryStatus(
  expiryDate: string | null | undefined,
  from: Date = new Date()
): ExpiryStatus {
  const days = daysUntilExpiry(expiryDate, from);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= EXPIRY_SOON_DAYS) return "expiring";
  return "valid";
}
