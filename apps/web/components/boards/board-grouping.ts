import type { BoardCard, BoardData } from "@/hooks/use-board-data";
import { PRIORITY_CONFIG, type Priority } from "@/lib/constants";
import type { BoardGroupBy, FacetOption } from "./board-filters";

/**
 * A horizontal swimlane: a labelled subset of the board whose columns carry
 * only the cards belonging to that lane. Columns are preserved so the
 * Kanban grid stays aligned across lanes.
 */
export interface BoardSwimlane {
  /** Stable key for React + dnd; "none" for the unassigned lane. */
  id: string;
  label: string;
  board: BoardData;
}

/** Distinct assignees across every card on the board, sorted by name. */
export function collectAssigneeOptions(board: BoardData): FacetOption[] {
  const map = new Map<string, string>();
  for (const col of board.columns) {
    for (const card of col.cards) {
      for (const a of card.assignees) {
        if (!map.has(a.user_id)) {
          map.set(a.user_id, a.full_name || "Sem nome");
        }
      }
    }
  }
  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/** Distinct tags across every card on the board, sorted by name. */
export function collectTagOptions(board: BoardData): FacetOption[] {
  const map = new Map<string, string>();
  for (const col of board.columns) {
    for (const card of col.cards) {
      for (const t of card.tags) {
        if (!map.has(t.id)) map.set(t.id, t.name);
      }
    }
  }
  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/** Builds a board whose columns hold only the given cards. */
function boardWithCards(
  board: BoardData,
  predicate: (card: BoardCard) => boolean
): BoardData {
  return {
    ...board,
    columns: board.columns.map((col) => ({
      ...col,
      cards: col.cards.filter(predicate),
    })),
  };
}

const PRIORITY_ORDER: Priority[] = ["critical", "high", "medium", "low"];

/**
 * Splits a board into swimlanes for the chosen group-by mode. For "column"
 * there is a single lane (the normal Kanban). For "assignee"/"priority" a
 * lane is emitted per distinct value, plus a trailing lane for cards with
 * no assignee. Empty lanes are dropped so the view stays compact.
 */
export function buildSwimlanes(
  board: BoardData,
  groupBy: BoardGroupBy
): BoardSwimlane[] {
  if (groupBy === "column") {
    return [{ id: "all", label: "", board }];
  }

  if (groupBy === "priority") {
    return PRIORITY_ORDER.map((priority) => ({
      id: priority,
      label: PRIORITY_CONFIG[priority].label,
      board: boardWithCards(board, (c) => c.priority === priority),
    })).filter((lane) => laneHasCards(lane.board));
  }

  // groupBy === "assignee"
  const assignees = collectAssigneeOptions(board);
  const lanes: BoardSwimlane[] = assignees.map((a) => ({
    id: a.id,
    label: a.label,
    board: boardWithCards(board, (c) =>
      c.assignees.some((x) => x.user_id === a.id)
    ),
  }));
  lanes.push({
    id: "none",
    label: "Sem responsável",
    board: boardWithCards(board, (c) => c.assignees.length === 0),
  });
  return lanes.filter((lane) => laneHasCards(lane.board));
}

/** True when any column in the lane's board carries a card. */
export function laneHasCards(board: BoardData): boolean {
  return board.columns.some((col) => col.cards.length > 0);
}
