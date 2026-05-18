// Pure helpers for survey reporting. Framework-free so they can be unit-tested
// directly and reused by the results UI.

/**
 * Participation rate as a 0-100 percentage, rounded to one decimal place.
 * Returns null when the eligible audience is zero (rate is undefined). The
 * `responded` count is clamped to `eligible` so a stale eligible figure can
 * never produce a rate above 100%.
 */
export function participationRate(
  responded: number,
  eligible: number
): number | null {
  if (eligible <= 0) return null;
  const capped = Math.min(Math.max(responded, 0), eligible);
  return Math.round((capped / eligible) * 1000) / 10;
}
