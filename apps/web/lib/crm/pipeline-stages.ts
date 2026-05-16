import type { Deal } from "@/hooks/crm/use-deals";

export interface StageColumn {
  columnId: string;
  stageName: string;
  stageColor: string;
  position: number;
  deals: Deal[];
}

export interface FunnelStage {
  stage: string;
  count: number;
  value: number;
  position: number;
}

/**
 * Groups deals into pipeline stage columns keyed by `board_columns.id`,
 * ordered by the column's real `position` (and name as a tie-breaker) so the
 * kanban renders deterministically. Replaces the previous insertion-order
 * grouping that hard-coded `position` to 0.
 */
export function buildStageColumns(deals: Deal[]): StageColumn[] {
  const columnMap = new Map<string, StageColumn>();
  for (const deal of deals) {
    const col = deal.card?.board_columns;
    if (!col) continue;
    if (!columnMap.has(col.id)) {
      columnMap.set(col.id, {
        columnId: col.id,
        stageName: col.name,
        stageColor: col.color,
        position: col.position ?? 0,
        deals: [],
      });
    }
    columnMap.get(col.id)!.deals.push(deal);
  }
  return Array.from(columnMap.values()).sort(
    (a, b) => a.position - b.position || a.stageName.localeCompare(b.stageName)
  );
}

/**
 * Builds an ordered funnel breakdown (count + value per stage) for open deals,
 * sorted by the board column's real `position` so the funnel is funnel-shaped.
 */
export function buildFunnelStages(deals: Deal[]): FunnelStage[] {
  const stageMap = new Map<
    string,
    { count: number; value: number; position: number }
  >();
  for (const deal of deals) {
    if (deal.actual_close_date) continue;
    const col = deal.card?.board_columns;
    const stage = col?.name ?? "Sem estagio";
    const existing = stageMap.get(stage) ?? {
      count: 0,
      value: 0,
      position: col?.position ?? Number.MAX_SAFE_INTEGER,
    };
    existing.count += 1;
    existing.value += Number(deal.value) || 0;
    stageMap.set(stage, existing);
  }
  return Array.from(stageMap.entries())
    .map(([stage, data]) => ({
      stage,
      count: data.count,
      value: data.value,
      position: data.position,
    }))
    .sort((a, b) => a.position - b.position || a.stage.localeCompare(b.stage));
}
