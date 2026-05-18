import { describe, it, expect } from "vitest";
import {
  buildSwimlanes,
  collectAssigneeOptions,
  collectTagOptions,
  laneHasCards,
} from "./board-grouping";
import type { BoardCard, BoardData } from "@/hooks/use-board-data";

function makeCard(
  id: string,
  priority: BoardCard["priority"],
  assignees: { user_id: string; full_name: string }[] = [],
  tags: { id: string; name: string }[] = []
): BoardCard {
  return {
    id,
    title: id,
    description: null,
    position: 0,
    priority,
    due_date: null,
    column_id: "col-1",
    sector_id: "s1",
    created_by: "u0",
    created_at: "2026-05-15T00:00:00Z",
    assignees: assignees.map((a) => ({ ...a, avatar_url: null })),
    tags: tags.map((t) => ({ ...t, color: "#000" })),
    cross_ref_count: 0,
  };
}

function makeBoard(cards: BoardCard[]): BoardData {
  return {
    id: "b1",
    name: "Board",
    description: null,
    updated_at: "2026-05-15T00:00:00Z",
    columns: [
      {
        id: "col-1",
        name: "A Fazer",
        color: null,
        position: 0,
        wip_limit: null,
        is_done_column: false,
        cards,
      },
      {
        id: "col-2",
        name: "Feito",
        color: null,
        position: 1,
        wip_limit: null,
        is_done_column: true,
        cards: [],
      },
    ],
  };
}

describe("collectAssigneeOptions / collectTagOptions", () => {
  it("returns distinct assignees sorted by name", () => {
    const board = makeBoard([
      makeCard("c1", "high", [{ user_id: "u2", full_name: "Bruno" }]),
      makeCard("c2", "low", [{ user_id: "u1", full_name: "Ana" }]),
      makeCard("c3", "low", [{ user_id: "u1", full_name: "Ana" }]),
    ]);
    expect(collectAssigneeOptions(board)).toEqual([
      { id: "u1", label: "Ana" },
      { id: "u2", label: "Bruno" },
    ]);
  });

  it("returns distinct tags", () => {
    const board = makeBoard([
      makeCard("c1", "high", [], [{ id: "t1", name: "bug" }]),
      makeCard("c2", "low", [], [{ id: "t1", name: "bug" }]),
    ]);
    expect(collectTagOptions(board)).toEqual([{ id: "t1", label: "bug" }]);
  });
});

describe("buildSwimlanes", () => {
  it("returns a single lane for the 'column' mode", () => {
    const board = makeBoard([makeCard("c1", "high")]);
    const lanes = buildSwimlanes(board, "column");
    expect(lanes).toHaveLength(1);
    expect(lanes[0].id).toBe("all");
  });

  it("splits by priority and drops empty priority lanes", () => {
    const board = makeBoard([
      makeCard("c1", "high"),
      makeCard("c2", "low"),
    ]);
    const lanes = buildSwimlanes(board, "priority");
    expect(lanes.map((l) => l.id)).toEqual(["high", "low"]);
    expect(lanes[0].board.columns[0].cards.map((c) => c.id)).toEqual(["c1"]);
  });

  it("splits by assignee with a trailing unassigned lane", () => {
    const board = makeBoard([
      makeCard("c1", "high", [{ user_id: "u1", full_name: "Ana" }]),
      makeCard("c2", "low"),
    ]);
    const lanes = buildSwimlanes(board, "assignee");
    expect(lanes.map((l) => l.id)).toEqual(["u1", "none"]);
    expect(lanes[1].label).toBe("Sem responsável");
  });

  it("omits the unassigned lane when every card has an assignee", () => {
    const board = makeBoard([
      makeCard("c1", "high", [{ user_id: "u1", full_name: "Ana" }]),
    ]);
    const lanes = buildSwimlanes(board, "assignee");
    expect(lanes.map((l) => l.id)).toEqual(["u1"]);
  });
});

describe("laneHasCards", () => {
  it("is true when a column carries a card", () => {
    expect(laneHasCards(makeBoard([makeCard("c1", "high")]))).toBe(true);
  });

  it("is false for an empty board", () => {
    expect(laneHasCards(makeBoard([]))).toBe(false);
  });
});
