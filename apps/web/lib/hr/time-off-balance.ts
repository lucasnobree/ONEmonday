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

/** Human-readable pt-BR warning for an over-balance request. */
export function overBalanceMessage(check: BalanceCheck): string | null {
  if (check.withinBalance) return null;
  return `Esta solicitação excede o saldo disponível em ${check.shortfall} dia${
    check.shortfall === 1 ? "" : "s"
  }. O saldo ficará negativo (${check.remaining}d).`;
}
