import { describe, it, expect } from "vitest";
import {
  buildListGroups,
  summarizeGroup,
  countGroupedCards,
} from "./board-list-util";
import type { BoardData, BoardCard } from "@/hooks/use-board-data";
import type { Priority } from "@/lib/constants";

function card(id: string, priority: Priority): BoardCard {
  return {
    id,
    title: id,
    description: null,
    position: 0,
    priority,
    due_date: null,
    column_id: "c1",
    sector_id: "s1",
    created_by: "u1",
    created_at: "2026-05-15T00:00:00Z",
    assignees: [],
    tags: [],
    cross_ref_count: 0,
    comment_count: 0,
  };
}

const board: BoardData = {
  id: "b1",
  name: "Board",
  description: null,
  updated_at: "2026-05-15T00:00:00Z",
  columns: [
    {
      id: "c1",
      name: "Todo",
      color: "#FDAB3D",
      position: 0,
      wip_limit: null,
      is_done_column: false,
      cards: [card("a", "high"), card("b", "low")],
    },
    {
      id: "c2",
      name: "Done",
      color: null,
      position: 1,
      wip_limit: null,
      is_done_column: true,
      cards: [card("c", "critical")],
    },
  ],
};

describe("buildListGroups", () => {
  it("emits one group per column, in order", () => {
    const groups = buildListGroups(board);
    expect(groups.map((g) => g.id)).toEqual(["c1", "c2"]);
    expect(groups[0].name).toBe("Todo");
    expect(groups[0].color).toBe("#FDAB3D");
  });

  it("carries each column's cards into its group", () => {
    const groups = buildListGroups(board);
    expect(groups[0].cards.map((c) => c.id)).toEqual(["a", "b"]);
    expect(groups[1].cards.map((c) => c.id)).toEqual(["c"]);
  });

  it("keeps a null color when the column has none", () => {
    expect(buildListGroups(board)[1].color).toBeNull();
  });
});

describe("summarizeGroup", () => {
  it("totals the cards", () => {
    expect(summarizeGroup(board.columns[0].cards).total).toBe(2);
  });

  it("counts cards per priority", () => {
    const summary = summarizeGroup(board.columns[0].cards);
    expect(summary.priorityCounts.high).toBe(1);
    expect(summary.priorityCounts.low).toBe(1);
    expect(summary.priorityCounts.critical).toBe(0);
    expect(summary.priorityCounts.medium).toBe(0);
  });

  it("handles an empty group", () => {
    const summary = summarizeGroup([]);
    expect(summary.total).toBe(0);
    expect(summary.priorityCounts.high).toBe(0);
  });
});

describe("countGroupedCards", () => {
  it("sums cards across every group", () => {
    expect(countGroupedCards(buildListGroups(board))).toBe(3);
  });

  it("returns 0 for no groups", () => {
    expect(countGroupedCards([])).toBe(0);
  });
});
