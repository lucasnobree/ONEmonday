/**
 * Pure helpers for legal contract renewal / expiry logic.
 *
 * Framework-free so they can be unit tested in isolation and reused by both
 * the contract list UI and the Legal dashboard. All date math is done at day
 * granularity in UTC to keep results deterministic regardless of timezone.
 */

/** Renewal handling configured on a contract, mirroring Ironclad's model. */
export type RenewalType = "none" | "auto" | "optional";

/**
 * Derived attention status for a contract's expiry / renewal:
 * - `none`     — no expiry date tracked, nothing to watch.
 * - `expired`  — expiry date has already passed.
 * - `notice`   — inside the termination-notice window; action is needed now
 *                to renew or to give notice before auto-renewal.
 * - `upcoming` — expires within {@link UPCOMING_WINDOW_DAYS} but the notice
 *                window has not opened yet.
 * - `ok`       — expires further out, nothing to do.
 */
export type RenewalStatus = "none" | "expired" | "notice" | "upcoming" | "ok";

/** Contracts expiring within this many days are flagged as "upcoming". */
export const UPCOMING_WINDOW_DAYS = 90;

/**
 * Whole days from `from` until `expiryDate` (negative once expired).
 * Returns `null` when no/invalid expiry date is given.
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
 * Classify a contract's expiry/renewal urgency.
 *
 * `noticePeriodDays` is the termination-notice window: the contract enters the
 * `notice` state once the days remaining fall at or below it. This is the
 * window in which a renewal decision (or a notice of non-renewal) must be made.
 */
export function getRenewalStatus(
  expiryDate: string | null | undefined,
  noticePeriodDays: number,
  from: Date = new Date()
): RenewalStatus {
  const days = daysUntilExpiry(expiryDate, from);
  if (days === null) return "none";
  if (days < 0) return "expired";
  const notice = Math.max(0, Math.floor(noticePeriodDays));
  if (days <= notice) return "notice";
  if (days <= UPCOMING_WINDOW_DAYS) return "upcoming";
  return "ok";
}

/**
 * The date by which a renew-or-notify decision must be made: `noticePeriodDays`
 * before the expiry date. Returns `null` when there is no expiry date.
 */
export function noticeDeadline(
  expiryDate: string | null | undefined,
  noticePeriodDays: number
): string | null {
  if (!expiryDate) return null;
  const expiry = Date.parse(`${expiryDate}T00:00:00Z`);
  if (Number.isNaN(expiry)) return null;
  const notice = Math.max(0, Math.floor(noticePeriodDays));
  const deadline = new Date(expiry - notice * 86_400_000);
  return deadline.toISOString().slice(0, 10);
}

/**
 * Whether a contract needs renewal attention now — true for the `notice` and
 * `expired` states. Used to build the dashboard's "needs attention" list.
 */
export function needsRenewalAttention(status: RenewalStatus): boolean {
  return status === "notice" || status === "expired";
}

/**
 * Human-readable summary of what will happen at expiry given the renewal type.
 * `auto` contracts roll over unless notice is given; `optional` need an active
 * decision; `none` simply lapse.
 */
export function renewalOutcomeLabel(renewalType: RenewalType): string {
  switch (renewalType) {
    case "auto":
      return "Renova automaticamente";
    case "optional":
      return "Renovacao opcional";
    default:
      return "Nao renova";
  }
}
