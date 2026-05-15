/**
 * Date-range presets for dashboard-level filtering.
 *
 * Metabase's strongest usability win is a single dashboard control that
 * re-scopes every card. Here a range is reduced to a simple rolling window of
 * N days, which is what the Analytics RPCs accept (`p_range_days`).
 */

export const RANGE_PRESETS = ["7d", "30d", "90d", "180d", "365d"] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number];

interface RangeOption {
  preset: RangePreset;
  label: string;
  /** Rolling window length in days. */
  days: number;
}

/** All selectable ranges, in display order. */
export const RANGE_OPTIONS: RangeOption[] = [
  { preset: "7d", label: "Ultimos 7 dias", days: 7 },
  { preset: "30d", label: "Ultimos 30 dias", days: 30 },
  { preset: "90d", label: "Ultimos 90 dias", days: 90 },
  { preset: "180d", label: "Ultimos 6 meses", days: 180 },
  { preset: "365d", label: "Ultimo ano", days: 365 },
];

/** The preset used when none is selected. */
export const DEFAULT_RANGE: RangePreset = "30d";

/** Type guard for a range preset string. */
export function isRangePreset(value: string): value is RangePreset {
  return (RANGE_PRESETS as readonly string[]).includes(value);
}

/**
 * Resolves a preset to its window length in days. Falls back to the default
 * range (30 days) for an unknown preset.
 */
export function rangeToDays(preset: string): number {
  const match = RANGE_OPTIONS.find((o) => o.preset === preset);
  return match ? match.days : 30;
}

/** Resolves a preset to its human-facing label. */
export function rangeLabel(preset: string): string {
  const match = RANGE_OPTIONS.find((o) => o.preset === preset);
  return match ? match.label : "Periodo";
}
