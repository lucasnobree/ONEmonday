// Pure formatting helpers for the Support Desk operational dashboard.
//
// Wave 4 audit H1: the dashboard reports bare counts. These helpers turn the
// raw numbers from the `get_support_operational_metrics` RPC into the
// human-readable pt-BR strings the KPI cards render.
//
// Kept free of React/Supabase so they are unit-testable in isolation.

/** The raw metrics row returned by `get_support_operational_metrics`. */
export interface SupportOperationalMetrics {
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  slaAttainmentPct: number | null;
  oldestBacklogMinutes: number | null;
  openBacklogCount: number;
}

/** A metrics row with every field zeroed / null — the empty/loading state. */
export const EMPTY_METRICS: SupportOperationalMetrics = {
  avgFirstResponseMinutes: null,
  avgResolutionMinutes: null,
  slaAttainmentPct: null,
  oldestBacklogMinutes: null,
  openBacklogCount: 0,
};

/**
 * Format a minute count as a compact pt-BR duration: "—" when null,
 * "<1min" / "42min" / "3h 15m" / "2d 4h". Always rounds toward a coarser
 * unit once it crosses a threshold so the cards stay scannable.
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) {
    return "—";
  }
  if (minutes < 1) return "<1min";

  const total = Math.round(minutes);
  if (total < 60) return `${total}min`;

  const hours = Math.floor(total / 60);
  if (hours < 24) {
    const m = total % 60;
    return m === 0 ? `${hours}h` : `${hours}h ${m}m`;
  }

  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return h === 0 ? `${days}d` : `${days}d ${h}h`;
}

/** Format an SLA attainment percentage: "—" when null, "97%" otherwise. */
export function formatPercent(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return "—";
  return `${Math.round(pct)}%`;
}

/**
 * Health bucket for an SLA attainment percentage, mirroring the colour
 * grading used elsewhere in the module: >= 95 good, >= 80 warning, else bad.
 */
export type AttainmentHealth = "good" | "warning" | "bad" | "neutral";

export function attainmentHealth(
  pct: number | null | undefined
): AttainmentHealth {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return "neutral";
  if (pct >= 95) return "good";
  if (pct >= 80) return "warning";
  return "bad";
}

/** Maps the raw RPC row (snake_case, possibly null) to the typed metrics. */
export function mapMetricsRow(
  row: Record<string, unknown> | null | undefined
): SupportOperationalMetrics {
  if (!row) return EMPTY_METRICS;
  const num = (v: unknown): number | null =>
    typeof v === "number" && !Number.isNaN(v)
      ? v
      : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))
        ? Number(v)
        : null;
  return {
    avgFirstResponseMinutes: num(row.avg_first_response_minutes),
    avgResolutionMinutes: num(row.avg_resolution_minutes),
    slaAttainmentPct: num(row.sla_attainment_pct),
    oldestBacklogMinutes: num(row.oldest_backlog_minutes),
    openBacklogCount: num(row.open_backlog_count) ?? 0,
  };
}
