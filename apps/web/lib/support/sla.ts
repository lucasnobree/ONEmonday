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

// ---------------------------------------------------------------------------
// Multi-state ticket status
// ---------------------------------------------------------------------------

/**
 * The full set of ticket statuses. `new` / `open` are active (agent-owned and
 * SLA running); `pending` / `on_hold` pause the SLA clock; `resolved` is the
 * terminal state.
 */
export const TICKET_STATUSES = [
  "new",
  "open",
  "pending",
  "on_hold",
  "resolved",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Statuses during which the SLA clock is paused (not counted against the agent). */
const PAUSED_STATUSES: ReadonlySet<TicketStatus> = new Set<TicketStatus>([
  "pending",
  "on_hold",
]);

/** Whether the SLA clock is paused while a ticket sits in the given status. */
export function isSlaPausedStatus(status: TicketStatus): boolean {
  return PAUSED_STATUSES.has(status);
}

/**
 * Compute the SLA bookkeeping change for a status transition.
 *
 * When a ticket enters a paused status the moment is recorded in
 * `slaPausedAt`. When it leaves a paused status, the elapsed paused span is
 * added to both SLA due dates so the time spent "waiting on the customer"
 * never counts against the agent.
 */
export function computeSlaPauseTransition(params: {
  fromStatus: TicketStatus;
  toStatus: TicketStatus;
  slaPausedAt: string | null | undefined;
  slaResponseDueAt: string | null | undefined;
  slaResolveDueAt: string | null | undefined;
  at?: Date;
}): {
  slaPausedAt: string | null;
  slaResponseDueAt: string | null;
  slaResolveDueAt: string | null;
  /** Milliseconds added to the SLA due dates by this transition. */
  pausedMsAdded: number;
} {
  const at = params.at ?? new Date();
  const wasPaused = isSlaPausedStatus(params.fromStatus);
  const willPause = isSlaPausedStatus(params.toStatus);
  let responseDue = params.slaResponseDueAt ?? null;
  let resolveDue = params.slaResolveDueAt ?? null;
  let pausedAt = params.slaPausedAt ?? null;
  let pausedMsAdded = 0;

  if (!wasPaused && willPause) {
    // Entering a paused state — start the pause clock.
    pausedAt = at.toISOString();
  } else if (wasPaused && !willPause) {
    // Leaving a paused state — fold the paused span into the due dates.
    if (params.slaPausedAt) {
      pausedMsAdded = Math.max(
        0,
        at.getTime() - new Date(params.slaPausedAt).getTime()
      );
      if (pausedMsAdded > 0) {
        if (responseDue) {
          responseDue = new Date(
            new Date(responseDue).getTime() + pausedMsAdded
          ).toISOString();
        }
        if (resolveDue) {
          resolveDue = new Date(
            new Date(resolveDue).getTime() + pausedMsAdded
          ).toISOString();
        }
      }
    }
    pausedAt = null;
  }

  return {
    slaPausedAt: pausedAt,
    slaResponseDueAt: responseDue,
    slaResolveDueAt: resolveDue,
    pausedMsAdded,
  };
}
