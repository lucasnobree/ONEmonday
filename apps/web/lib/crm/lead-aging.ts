/**
 * Lead-aging / SLA helpers for the CRM Leads inbox.
 *
 * A new lead with no owner attention is a lost lead — best practice expects
 * first contact within an SLA window (24h by default). These pure helpers
 * turn a lead's `created_at` + `status` and the sector's `crm_lead_sla_hours`
 * into a "time since received" label and an overdue flag the inbox renders.
 *
 * Kept free of React/Tailwind so the rules are trivially unit-testable.
 */
import type { LeadStatus } from "@/lib/validations/crm";

/** The default SLA window when a sector has not configured one. */
export const DEFAULT_LEAD_SLA_HOURS = 24;

/** How a lead sits against its SLA. */
export type LeadAgingState =
  /** Untouched ('new') and past the SLA window — needs attention now. */
  | "overdue"
  /** Untouched ('new') but still inside the SLA window. */
  | "aging"
  /** Worked, qualified or discarded — the SLA no longer applies. */
  | "ok";

/** The aging verdict for a single lead row. */
export interface LeadAging {
  /** Whole hours since the lead was received. */
  hours: number;
  /** SLA state. */
  state: LeadAgingState;
  /** A short pt-BR "time since received" label (e.g. "há 3 dias"). */
  label: string;
}

/** The minimal lead shape the aging rules read. */
export interface AgeableLead {
  status: LeadStatus;
  created_at: string;
}

/**
 * Whole hours elapsed between `createdAt` and `now`. Never negative — a
 * future-dated row (clock skew) reads as 0.
 */
export function hoursSince(createdAt: string, now: Date = new Date()): number {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return 0;
  const ms = now.getTime() - created;
  return ms <= 0 ? 0 : Math.floor(ms / 3_600_000);
}

/**
 * A short pt-BR elapsed-time label. Resolution steps down by magnitude:
 * minutes under an hour, hours under a day, then days.
 */
export function agingLabel(createdAt: string, now: Date = new Date()): string {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return "—";
  const ms = Math.max(0, now.getTime() - created);
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}

/**
 * Classify a lead against its sector SLA.
 *
 * Only an untouched ('new') lead can be `overdue`/`aging` — once a rep starts
 * working it, qualifies or discards it, the first-contact SLA is satisfied.
 * An `slaHours` of 0 disables the overdue verdict (the indicator is off).
 *
 * @param lead     The lead (status + created_at).
 * @param slaHours The sector's SLA window in hours (0 = disabled).
 * @param now      Injectable clock, for deterministic tests.
 */
export function classifyLeadAging(
  lead: AgeableLead,
  slaHours: number,
  now: Date = new Date()
): LeadAging {
  const hours = hoursSince(lead.created_at, now);
  const label = agingLabel(lead.created_at, now);

  if (lead.status !== "new") {
    return { hours, state: "ok", label };
  }
  if (slaHours > 0 && hours >= slaHours) {
    return { hours, state: "overdue", label };
  }
  return { hours, state: "aging", label };
}
