// Pure SLA breach / warning helpers for the Support Desk module.
//
// Wave 4 audit S2: an SLA rule defined response/resolve windows but said
// nothing about what happens on breach. These helpers decide, for a single
// ticket against its rule, whether a warning or a breach action should fire —
// independent of Supabase so the decision is unit-testable. A server-side
// sweep (cron / scheduled worker) is the intended consumer; it stays out of
// the Wave 5 slice and is noted as deferred.

import { slaRemainingPct } from "./sla";

/** A breach action configured on an SLA rule (mirrors migration 00196). */
export type SlaBreachAction = "none" | "notify" | "escalate";

/** The escalation outcome for one ticket evaluated against its rule. */
export type SlaBreachOutcome = "none" | "warn" | "breach";

/**
 * Decide whether a ticket needs a warning or a breach action.
 *
 *  - `breach` — the active SLA deadline has passed and the rule has a
 *    non-`none` breach action.
 *  - `warn`   — the active SLA window has elapsed past the rule's warn
 *    threshold (e.g. 80%) but is not yet breached.
 *  - `none`   — still healthy, or the rule takes no action.
 *
 * `alreadyActioned` short-circuits to `none` so a sweep never re-fires for a
 * ticket whose breach action has already been applied.
 */
export function evaluateSlaBreach(params: {
  createdAt: string | null | undefined;
  deadlineAt: string | null | undefined;
  breachAction: SlaBreachAction;
  warnThresholdPct: number;
  alreadyActioned: boolean;
  at?: Date;
}): SlaBreachOutcome {
  const {
    createdAt,
    deadlineAt,
    breachAction,
    warnThresholdPct,
    alreadyActioned,
  } = params;

  if (alreadyActioned) return "none";
  if (breachAction === "none") return "none";

  const pctRemaining = slaRemainingPct({
    createdAt,
    deadlineAt,
    at: params.at,
  });
  if (pctRemaining === null) return "none";

  // pctRemaining <= 0 means the deadline has passed.
  if (pctRemaining <= 0) return "breach";

  // The elapsed fraction of the window: 100 - remaining.
  const elapsedPct = 100 - pctRemaining;
  if (elapsedPct >= warnThresholdPct) return "warn";

  return "none";
}

/** The support_notifications `type` produced by a breach outcome. */
export function notificationTypeFor(
  outcome: SlaBreachOutcome,
  breachAction: SlaBreachAction
): "sla_warning" | "sla_breach" | "sla_escalation" | null {
  if (outcome === "warn") return "sla_warning";
  if (outcome === "breach") {
    return breachAction === "escalate" ? "sla_escalation" : "sla_breach";
  }
  return null;
}
