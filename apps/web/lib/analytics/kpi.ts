/**
 * KPI computation helpers for the Analytics module.
 *
 * Pure functions — no I/O — so they are trivially unit-testable. The Analytics
 * RPCs return a "current" and a "previous" value for each KPI (the previous
 * being the immediately preceding equal-length window); these helpers turn
 * that pair into a displayable period-over-period delta.
 */

import type { MetricUnit } from "./metrics";

/** Direction of a period-over-period change. */
export type DeltaDirection = "up" | "down" | "flat";

export interface KpiDelta {
  /** Absolute change: current - previous. */
  absolute: number;
  /**
   * Percentage change, rounded to one decimal. `null` when the previous
   * value is 0 (an undefined ratio — shown as "novo" / "—" in the UI).
   */
  percent: number | null;
  direction: DeltaDirection;
}

/**
 * Computes the period-over-period delta between a current and previous value.
 * A change is treated as "flat" only when the two values are exactly equal.
 */
export function computeDelta(current: number, previous: number): KpiDelta {
  const absolute = current - previous;

  let direction: DeltaDirection = "flat";
  if (absolute > 0) direction = "up";
  else if (absolute < 0) direction = "down";

  let percent: number | null = null;
  if (previous !== 0) {
    percent = Math.round((absolute / Math.abs(previous)) * 1000) / 10;
  }

  return { absolute, percent, direction };
}

/**
 * Whether a delta should be styled as positive (green) given the metric's
 * desired direction. A "flat" delta is neutral (returns `false`).
 */
export function isFavorableDelta(
  delta: KpiDelta,
  higherIsBetter: boolean
): boolean {
  if (delta.direction === "flat") return false;
  return higherIsBetter
    ? delta.direction === "up"
    : delta.direction === "down";
}

/**
 * Formats a metric value for display according to its unit. Currency values
 * arrive as integer cents and are rendered in BRL; counts use thousands
 * grouping. Kept dependency-free (no money.ts import) so the Analytics module
 * stays decoupled from Finance.
 */
export function formatMetricValue(value: number, unit: MetricUnit): string {
  if (unit === "currency_cents") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100);
  }
  return new Intl.NumberFormat("pt-BR").format(value);
}

/** Formats a delta percentage like "+12.5%" / "-3%" / "—". */
export function formatDeltaPercent(delta: KpiDelta): string {
  if (delta.percent === null) return "—";
  const sign = delta.percent > 0 ? "+" : "";
  return `${sign}${delta.percent}%`;
}
