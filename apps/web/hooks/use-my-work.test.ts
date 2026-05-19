import { describe, it, expect } from "vitest";
import { mapMyWorkRows, sortMyWorkItems, type MyWorkItem } from "./use-my-work";

/** Minimal valid raw assignee row, overridable per test. */
function rawRow(overrides: {
  card?: Partial<{
    id: string;
    title: string;
    priority: string | null;
    due_date: string | null;
    is_active: boolean | null;
  }>;
  board?: Partial<{ id: string; name: string; is_active: boolean | null }> | null;
  sector?: Partial<{ id: string; name: string; slug: string }> | null;
  column?: Partial<{
    name: string;
    color: string | null;
    is_done_column: boolean | null;
  }> | null;
  nullCard?: boolean;
}) {
  if (overrides.nullCard) return { cards: null };
  return {
    cards: {
      id: "card-1",
      title: "Task",
      priority: "medium",
      due_date: "2026-05-20",
      is_active: true,
      board_id: "board-1",
      sector_id: "sector-1",
      ...overrides.card,
      boards:
        overrides.board === null
          ? null
          : { id: "board-1", name: "Board A", is_active: true, ...overrides.board },
      sectors:
        overrides.sector === null
          ? null
          : { id: "sector-1", name: "Sector A", slug: "sec-a", ...overrides.sector },
      board_columns:
        overrides.column === null
          ? null
          : {
              name: "To Do",
              color: "#fff",
              is_done_column: false,
              ...overrides.column,
            },
    },
  };
}

describe("mapMyWorkRows", () => {
  it("maps a complete row into a MyWorkItem", () => {
    const items = mapMyWorkRows([rawRow({})]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      cardId: "card-1",
      title: "Task",
      priority: "medium",
      boardId: "board-1",
      boardName: "Board A",
      sectorName: "Sector A",
      sectorSlug: "sec-a",
      columnName: "To Do",
      isDone: false,
    });
  });

  it("drops rows whose card is null or inactive", () => {
    expect(mapMyWorkRows([rawRow({ nullCard: true })])).toHaveLength(0);
    expect(
      mapMyWorkRows([rawRow({ card: { is_active: false } })])
    ).toHaveLength(0);
  });

  it("drops rows whose board is missing or inactive", () => {
    expect(mapMyWorkRows([rawRow({ board: null })])).toHaveLength(0);
    expect(
      mapMyWorkRows([rawRow({ board: { is_active: false } })])
    ).toHaveLength(0);
  });

  it("drops rows whose sector is missing", () => {
    expect(mapMyWorkRows([rawRow({ sector: null })])).toHaveLength(0);
  });

  it("defaults priority and column when absent", () => {
    const items = mapMyWorkRows([
      rawRow({ card: { priority: null }, column: null }),
    ]);
    expect(items[0].priority).toBe("medium");
    expect(items[0].columnName).toBe("—");
    expect(items[0].isDone).toBe(false);
  });

  it("flags a card in a done column", () => {
    const items = mapMyWorkRows([
      rawRow({ column: { is_done_column: true } }),
    ]);
    expect(items[0].isDone).toBe(true);
  });
});

describe("sortMyWorkItems", () => {
  function item(partial: Partial<MyWorkItem>): MyWorkItem {
    return {
      cardId: "c",
      title: "T",
      priority: "medium",
      dueDate: null,
      boardId: "b",
      boardName: "B",
      sectorId: "s",
      sectorName: "S",
      sectorSlug: "s",
      columnName: "Col",
      columnColor: null,
      isDone: false,
      ...partial,
    };
  }

  it("orders by due date ascending, null dates last", () => {
    const sorted = sortMyWorkItems([
      item({ cardId: "late", dueDate: "2026-06-01" }),
      item({ cardId: "none", dueDate: null }),
      item({ cardId: "early", dueDate: "2026-05-01" }),
    ]);
    expect(sorted.map((i) => i.cardId)).toEqual(["early", "late", "none"]);
  });

  it("breaks due-date ties by priority", () => {
    const sorted = sortMyWorkItems([
      item({ cardId: "low", dueDate: "2026-05-10", priority: "low" }),
      item({ cardId: "crit", dueDate: "2026-05-10", priority: "critical" }),
    ]);
    expect(sorted.map((i) => i.cardId)).toEqual(["crit", "low"]);
  });

  it("does not mutate the input array", () => {
    const input = [item({ cardId: "a" })];
    sortMyWorkItems(input);
    expect(input).toHaveLength(1);
  });
});
