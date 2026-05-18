/**
 * Pure helpers for time-off balance validation, shared by the server actions
 * and the request dialog so the "would this go negative?" rule is defined in
 * exactly one place.
 */

export interface BalanceCheck {
  /** Whether the request fits within the available balance. */
  withinBalance: boolean;
  /** Days the balance would be short by (0 when within balance). */
  shortfall: number;
  /** Balance that would remain after the request (may be negative). */
  remaining: number;
}

/**
 * Evaluate a time-off request against the currently available balance.
 *
 * `available` is total_days minus already approved+pending days (the value
 * returned by the get_time_off_available_days RPC). `requested` is the day
 * count of the new request.
 */
export function checkTimeOffBalance(
  available: number,
  requested: number
): BalanceCheck {
  const remaining = available - requested;
  return {
    withinBalance: remaining >= 0,
    shortfall: remaining < 0 ? -remaining : 0,
    remaining,
  };
}

/**
 * The balance year a time-off request draws from: the year of its start date.
 * Balances are tracked per calendar year, so a 2027-dated request must resolve
 * against the 2027 balance, not the year the table happens to be viewed in.
 *
 * The year is read from the leading `YYYY` of an ISO date string to avoid the
 * timezone drift `new Date(iso).getFullYear()` causes for UTC-midnight dates.
 * Falls back to the current year when the date is missing or unparseable.
 */
export function balanceYearForDate(startDate: string | null | undefined): number {
  if (startDate) {
    const match = /^(\d{4})-\d{2}-\d{2}/.exec(startDate);
    if (match) return Number(match[1]);
    const parsed = new Date(startDate);
    if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear();
  }
  return new Date().getFullYear();
}

/** Human-readable pt-BR warning for an over-balance request. */
export function overBalanceMessage(check: BalanceCheck): string | null {
  if (check.withinBalance) return null;
  return `Esta solicitação excede o saldo disponível em ${check.shortfall} dia${
    check.shortfall === 1 ? "" : "s"
  }. O saldo ficará negativo (${check.remaining}d).`;
}
