/**
 * Incident analytics helpers for the Dev-Tools module.
 *
 * Pure functions over incident records so the dashboard and lists stay
 * consistent and the logic is unit-testable without a database. Modelled on
 * PagerDuty's headline metrics: time-to-acknowledge (MTTA) and time-to-resolve
 * (MTTR).
 */

/** Minimal shape an incident needs for metric calculations. */
export interface IncidentLike {
  status: string;
  severity: string;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

/** An incident is "open" until it reaches the resolved status. */
export function isIncidentOpen(incident: { status: string }): boolean {
  return incident.status !== "resolved";
}

/** Lower weight = more urgent. Used to sort incident backlogs. */
const SEVERITY_WEIGHT: Record<string, number> = {
  sev1: 0,
  sev2: 1,
  sev3: 2,
  sev4: 3,
};

export function severityWeight(severity: string): number {
  return SEVERITY_WEIGHT[severity] ?? 9;
}

/**
 * Duration in minutes between two ISO timestamps, or `null` when either is
 * missing. Negative results (clock skew / bad data) are clamped to 0.
 */
function minutesBetween(
  start: string | null,
  end: string | null
): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.round(ms / 60000));
}

/** Minutes from creation to acknowledgement, or null if not acknowledged. */
export function timeToAcknowledge(incident: IncidentLike): number | null {
  return minutesBetween(incident.created_at, incident.acknowledged_at);
}

/** Minutes from creation to resolution, or null if not resolved. */
export function timeToResolve(incident: IncidentLike): number | null {
  return minutesBetween(incident.created_at, incident.resolved_at);
}

/** Arithmetic mean of a list of numbers, or null when the list is empty. */
function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, v) => sum + v, 0);
  return Math.round(total / values.length);
}

export interface IncidentMetrics {
  total: number;
  open: number;
  resolved: number;
  /** Mean time to acknowledge, in minutes (null when no data). */
  mttaMinutes: number | null;
  /** Mean time to resolve, in minutes (null when no data). */
  mttrMinutes: number | null;
  /** Open incident counts keyed by severity. */
  openBySeverity: Record<string, number>;
}

/** Aggregates a list of incidents into the dashboard metric set. */
export function summarizeIncidents(
  incidents: IncidentLike[]
): IncidentMetrics {
  const open = incidents.filter(isIncidentOpen);
  const resolved = incidents.filter((i) => !isIncidentOpen(i));

  const mttaValues = incidents
    .map(timeToAcknowledge)
    .filter((v): v is number => v !== null);
  const mttrValues = incidents
    .map(timeToResolve)
    .filter((v): v is number => v !== null);

  const openBySeverity: Record<string, number> = {};
  for (const incident of open) {
    openBySeverity[incident.severity] =
      (openBySeverity[incident.severity] ?? 0) + 1;
  }

  return {
    total: incidents.length,
    open: open.length,
    resolved: resolved.length,
    mttaMinutes: mean(mttaValues),
    mttrMinutes: mean(mttrValues),
    openBySeverity,
  };
}

/**
 * Resolves the lifecycle timestamps for an incident given a target status and
 * its current timestamps.
 *
 * - Leaving the `investigating` status implies the incident was acknowledged,
 *   so `acknowledged_at` is stamped once when it first becomes non-null.
 * - Reaching `resolved` stamps `resolved_at`; moving back out of `resolved`
 *   (a reopen) clears it again.
 *
 * `now` is injectable to keep the function deterministic in tests.
 */
export function resolveLifecycleTimestamps(
  status: string,
  current: { acknowledged_at: string | null; resolved_at: string | null },
  now: string = new Date().toISOString()
): { acknowledged_at: string | null; resolved_at: string | null } {
  const acknowledged_at =
    current.acknowledged_at ?? (status !== "investigating" ? now : null);

  const resolved_at =
    status === "resolved" ? (current.resolved_at ?? now) : null;

  return { acknowledged_at, resolved_at };
}

/**
 * Formats a minute count as a compact human duration (e.g. "0m", "45m",
 * "3h 12m", "2d 4h"). Returns "-" for null.
 */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "-";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rem = minutes % 60;
    return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours === 0 ? `${days}d` : `${days}d ${remHours}h`;
}
