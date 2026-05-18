/**
 * Pure helpers for legal-matter triage: priority ordering and due-date
 * urgency. Framework-free so they can be unit tested and shared by the
 * matters list, the detail sheet and the dashboard.
 */
import { daysUntilExpiry } from "./renewal";
import type { BadgeVariant } from "./labels";

/**
 * Sort weight per matter priority — lower sorts first (most urgent on top).
 * An unknown priority falls back to a large weight so it sinks to the bottom.
 */
export const MATTER_PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Weight for a priority value, with a safe fallback for unknown values. */
export function matterPriorityWeight(priority: string): number {
  return MATTER_PRIORITY_WEIGHT[priority] ?? 9;
}

/**
 * Comparator that orders matters by priority weight (urgent → low).
 * Use as `matters.slice().sort(compareMatterByPriority)`.
 */
export function compareMatterByPriority(
  a: { priority: string },
  b: { priority: string }
): number {
  return matterPriorityWeight(a.priority) - matterPriorityWeight(b.priority);
}

/**
 * Matter statuses that are "done" — an overdue due date on these is not
 * actionable, so the urgency signal is suppressed for them.
 */
const CLOSED_MATTER_STATUSES = new Set(["resolved", "closed"]);

/** Due-date urgency for a matter, mirroring the contract renewal signal. */
export type MatterDueUrgency = "none" | "ok" | "soon" | "overdue";

/** Due dates within this many days are flagged as "soon". */
export const MATTER_DUE_SOON_DAYS = 7;

export interface MatterDueStatus {
  urgency: MatterDueUrgency;
  /** Whole days until the due date (negative once overdue); null if no date. */
  days: number | null;
  /** Badge variant for the urgency, or null when nothing should be badged. */
  variant: BadgeVariant | null;
  /** Short pt-BR label for the badge, or null when nothing should be badged. */
  label: string | null;
}

/**
 * Classifies a matter's due-date urgency. A matter that is already resolved or
 * closed never reports `soon`/`overdue` — its deadline is moot.
 */
export function matterDueStatus(
  dueDate: string | null | undefined,
  status: string,
  from: Date = new Date()
): MatterDueStatus {
  const days = daysUntilExpiry(dueDate, from);
  if (days === null) {
    return { urgency: "none", days: null, variant: null, label: null };
  }
  if (CLOSED_MATTER_STATUSES.has(status)) {
    return { urgency: "ok", days, variant: null, label: null };
  }
  if (days < 0) {
    return {
      urgency: "overdue",
      days,
      variant: "destructive",
      label: `Atrasada ${Math.abs(days)}d`,
    };
  }
  if (days <= MATTER_DUE_SOON_DAYS) {
    return {
      urgency: "soon",
      days,
      variant: "secondary",
      label: days === 0 ? "Vence hoje" : `Vence em ${days}d`,
    };
  }
  return { urgency: "ok", days, variant: null, label: null };
}
