/**
 * Deal rotting (staleness) logic for the CRM pipeline.
 *
 * A deal "rots" when it sits in a pipeline stage longer than that stage's
 * configured `rotting_days` threshold without changing stage. This mirrors
 * Pipedrive's rotting feature: a per-stage idle threshold that visually flags
 * deals needing attention. A threshold of 0 disables rotting for the stage.
 */

/** Per-stage rotting configuration, keyed by stage (board column) name. */
export type RottingConfig = Record<string, number>;

export interface DealRottingStatus {
  /** Whether rotting is enabled for the deal's current stage. */
  enabled: boolean;
  /** Whole days the deal has been idle in its current stage. */
  idleDays: number;
  /** True once idleDays meets or exceeds the stage threshold. */
  isRotting: boolean;
  /** The stage threshold in days (0 when disabled). */
  thresholdDays: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Compute how many whole days have elapsed since `lastStageChangeAt`.
 * Never returns a negative number (future timestamps clamp to 0).
 */
export function idleDaysSince(
  lastStageChangeAt: string | Date,
  now: Date = new Date()
): number {
  const since = new Date(lastStageChangeAt).getTime();
  if (Number.isNaN(since)) return 0;
  const diff = now.getTime() - since;
  if (diff <= 0) return 0;
  return Math.floor(diff / MS_PER_DAY);
}

/**
 * Resolve the rotting status of a single deal.
 *
 * @param stageName          The deal's current stage (board column) name.
 * @param lastStageChangeAt  When the deal last entered its current stage.
 * @param config             Per-stage rotting thresholds in days.
 * @param now                Reference time (injectable for testing).
 */
export function getDealRotting(
  stageName: string | null | undefined,
  lastStageChangeAt: string | Date | null | undefined,
  config: RottingConfig,
  now: Date = new Date()
): DealRottingStatus {
  const thresholdDays = stageName ? (config[stageName] ?? 0) : 0;
  const enabled = thresholdDays > 0;

  if (!enabled || !lastStageChangeAt) {
    return { enabled: false, idleDays: 0, isRotting: false, thresholdDays: 0 };
  }

  const idleDays = idleDaysSince(lastStageChangeAt, now);
  return {
    enabled: true,
    idleDays,
    isRotting: idleDays >= thresholdDays,
    thresholdDays,
  };
}

/** Human-readable pt-BR label for a rotting badge, or null when not rotting. */
export function rottingLabel(status: DealRottingStatus): string | null {
  if (!status.isRotting) return null;
  return status.idleDays === 1
    ? "Parada ha 1 dia"
    : `Parada ha ${status.idleDays} dias`;
}
