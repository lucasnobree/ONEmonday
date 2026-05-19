import type { BoardData, BoardCard } from "@/hooks/use-board-data";
import type { Priority } from "@/lib/constants";

/**
 * A column-banded group for the Table/List view: the board column plus the
 * cards it holds. Mirrors Monday's "colored Group" — the band carries the
 * column color down every row.
 */
export interface BoardListGroup {
  id: string;
  name: string;
  color: string | null;
  cards: BoardCard[];
}

/** Per-group aggregates rendered in the group summary row. */
export interface BoardGroupSummary {
  /** Total cards in the group. */
  total: number;
  /** Count of cards per priority — the Status-distribution mini-bar. */
  priorityCounts: Record<Priority, number>;
}

/** Builds the column-banded groups for the list view, in column order. */
export function buildListGroups(board: BoardData): BoardListGroup[] {
  return board.columns.map((col) => ({
    id: col.id,
    name: col.name,
    color: col.color,
    cards: col.cards,
  }));
}

/** Computes the summary aggregates for a group's cards. */
export function summarizeGroup(cards: BoardCard[]): BoardGroupSummary {
  const priorityCounts: Record<Priority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const card of cards) {
    priorityCounts[card.priority] += 1;
  }
  return { total: cards.length, priorityCounts };
}

/** Total cards across every group — the board-level count. */
export function countGroupedCards(groups: BoardListGroup[]): number {
  return groups.reduce((sum, g) => sum + g.cards.length, 0);
}
