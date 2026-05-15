// Pure SLA helpers for the Support Desk module.
// Kept free of Supabase/React so they can be unit tested in isolation.

/**
 * Whether an SLA deadline has been missed at a given moment.
 * A null deadline means no SLA applies, so it can never be breached.
 */
export function isSlaBreached(
  dueAt: string | null | undefined,
  at: Date = new Date()
): boolean {
  if (!dueAt) return false;
  return at.getTime() > new Date(dueAt).getTime();
}

/**
 * Resolve the response-SLA breach flag when a ticket is resolved.
 * The response SLA is breached if it was already flagged, or if the
 * ticket is being resolved with no first response recorded after its
 * response deadline passed.
 */
export function computeResponseBreachOnResolve(params: {
  alreadyBreached: boolean;
  firstResponseAt: string | null | undefined;
  responseDueAt: string | null | undefined;
  at?: Date;
}): boolean {
  const { alreadyBreached, firstResponseAt, responseDueAt, at } = params;
  if (alreadyBreached) return true;
  if (firstResponseAt) return false;
  return isSlaBreached(responseDueAt, at);
}

/**
 * SLA health bucket for a remaining-percentage value (0-100+).
 * Mirrors the colour thresholds used across the Support UI.
 */
export type SlaHealth = "breached" | "critical" | "warning" | "ok";

export function slaHealthFromPercentRemaining(pct: number): SlaHealth {
  if (pct <= 0) return "breached";
  if (pct < 25) return "critical";
  if (pct <= 50) return "warning";
  return "ok";
}
