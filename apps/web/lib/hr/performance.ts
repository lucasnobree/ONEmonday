// Pure helpers for HR performance management — the 9-box matrix and survey
// scoring. Kept framework-free so they can be unit-tested directly and reused
// by both the server actions and the client components.

/** A 9-box cell, identified by its 1-3 performance and potential scores. */
export interface NineBoxCell {
  performance: number;
  potential: number;
  label: string;
}

/**
 * Maps a (performance, potential) pair — each on a 1-3 scale — onto the
 * canonical 9-box cell label. Returns null if either score is out of range.
 */
export function nineBoxCell(
  performance: number,
  potential: number
): NineBoxCell | null {
  if (
    !Number.isInteger(performance) ||
    !Number.isInteger(potential) ||
    performance < 1 ||
    performance > 3 ||
    potential < 1 ||
    potential > 3
  ) {
    return null;
  }

  const labels: Record<string, string> = {
    "1-1": "Risco",
    "2-1": "Questionável",
    "3-1": "Enigma",
    "1-2": "Eficaz",
    "2-2": "Mantenedor",
    "3-2": "Forte desempenho",
    "1-3": "Especialista",
    "2-3": "Alto potencial",
    "3-3": "Estrela",
  };

  return {
    performance,
    potential,
    label: labels[`${performance}-${potential}`],
  };
}

/**
 * Classifies a 0-10 eNPS score into the standard promoter / passive / detractor
 * bucket.
 */
export function enpsBucket(
  score: number
): "promoter" | "passive" | "detractor" | null {
  if (!Number.isFinite(score) || score < 0 || score > 10) return null;
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

/**
 * Computes the eNPS (% promoters − % detractors) for a set of 0-10 scores.
 * Returns null when there are no valid scores. Result is rounded to one
 * decimal place, in the range -100..100.
 */
export function calculateEnps(scores: number[]): number | null {
  const valid = scores.filter((s) => enpsBucket(s) !== null);
  if (valid.length === 0) return null;

  const promoters = valid.filter((s) => enpsBucket(s) === "promoter").length;
  const detractors = valid.filter((s) => enpsBucket(s) === "detractor").length;

  return Math.round(((promoters - detractors) / valid.length) * 1000) / 10;
}

/**
 * Computes the average of a set of numeric survey answers, rounded to two
 * decimal places. Returns null when there are no values.
 */
export function averageScore(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / values.length) * 100) / 100;
}
