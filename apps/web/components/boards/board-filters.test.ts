import { describe, it, expect } from "vitest";
import {
  cardMatchesFilters,
  applyBoardFilters,
  countBoardCards,
  priorityFilterLabel,
  dueDateMatches,
  isBoardFiltered,
  activeFilterCount,
  EMPTY_BOARD_FILTERS,
  type BoardFilterState,
} from "./board-filters";
import type { BoardCard, BoardData } from "@/hooks/use-board-data";

/** Builds a filter state from a partial override over the empty default. */
function filters(partial: Partial<BoardFilterState>): BoardFilterState {
  return { ...EMPTY_BOARD_FILTERS, ...partial };
}

function makeCard(
  id: string,
  title: string,
  priority: BoardCard["priority"]
): BoardCard {
  return {
    id,
    title,
    description: null,
    position: 0,
    priority,
    due_date: null,
    column_id: "col-1",
    sector_id: "sector-1",
    created_by: "user-1",
    created_at: "2026-05-15T00:00:00Z",
    assignees: [],
    tags: [],
    cross_ref_count: 0,
  };
}

function makeBoard(): BoardData {
  return {
    id: "board-1",
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
        cards: [
          makeCard("c1", "Corrigir login", "high"),
          makeCard("c2", "Atualizar README", "low"),
        ],
      },
      {
        id: "col-2",
        name: "Concluido",
        color: null,
        position: 1,
        wip_limit: null,
        is_done_column: true,
        cards: [makeCard("c3", "Deploy de producao", "critical")],
      },
    ],
  };
}

describe("cardMatchesFilters", () => {
  const card = makeCard("c1", "Corrigir Login", "high");

  it("matches everything when filters are empty", () => {
    expect(cardMatchesFilters(card, EMPTY_BOARD_FILTERS)).toBe(true);
  });

  it("matches a case-insensitive substring of the title", () => {
    expect(cardMatchesFilters(card, filters({ search: "login" }))).toBe(true);
  });

  it("rejects a card whose title does not contain the query", () => {
    expect(cardMatchesFilters(card, filters({ search: "deploy" }))).toBe(
      false
    );
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(cardMatchesFilters(card, filters({ search: "  login  " }))).toBe(
      true
    );
  });

  it("filters by exact priority", () => {
    expect(cardMatchesFilters(card, filters({ priority: "high" }))).toBe(
      true
    );
    expect(cardMatchesFilters(card, filters({ priority: "low" }))).toBe(
      false
    );
  });

  it("requires both search and priority to match", () => {
    expect(
      cardMatchesFilters(card, filters({ search: "login", priority: "low" }))
    ).toBe(false);
  });

  it("matches when the card has any of the selected assignees", () => {
    const assigned: BoardCard = {
      ...card,
      assignees: [{ user_id: "u1", full_name: "Ana", avatar_url: null }],
    };
    expect(
      cardMatchesFilters(assigned, filters({ assignees: ["u1"] }))
    ).toBe(true);
    expect(
      cardMatchesFilters(assigned, filters({ assignees: ["u2"] }))
    ).toBe(false);
  });

  it("matches when the card has any of the selected tags", () => {
    const tagged: BoardCard = {
      ...card,
      tags: [{ id: "t1", name: "bug", color: "#f00" }],
    };
    expect(cardMatchesFilters(tagged, filters({ tags: ["t1"] }))).toBe(true);
    expect(cardMatchesFilters(tagged, filters({ tags: ["t2"] }))).toBe(false);
  });
});

describe("dueDateMatches", () => {
  // Local-time noon on 2026-05-18, so day-bucket maths is timezone-stable.
  const now = new Date(2026, 4, 18, 12, 0, 0);
  /** A local-midnight date for the given local Y/M/D. */
  const at = (y: number, m: number, d: number) =>
    new Date(y, m - 1, d, 10, 0, 0).toISOString();

  it("matches everything for the 'all' bucket", () => {
    expect(dueDateMatches(null, "all", now)).toBe(true);
    expect(dueDateMatches(at(2020, 1, 1), "all", now)).toBe(true);
  });

  it("'none' matches only cards without a due date", () => {
    expect(dueDateMatches(null, "none", now)).toBe(true);
    expect(dueDateMatches(at(2026, 5, 18), "none", now)).toBe(false);
  });

  it("'overdue' matches a due date before today", () => {
    expect(dueDateMatches(at(2026, 5, 10), "overdue", now)).toBe(true);
    expect(dueDateMatches(at(2026, 5, 25), "overdue", now)).toBe(false);
  });

  it("'today' matches only the current day", () => {
    expect(dueDateMatches(at(2026, 5, 18), "today", now)).toBe(true);
    expect(dueDateMatches(at(2026, 5, 19), "today", now)).toBe(false);
  });

  it("'week' matches the next 7 days", () => {
    expect(dueDateMatches(at(2026, 5, 20), "week", now)).toBe(true);
    expect(dueDateMatches(at(2026, 5, 30), "week", now)).toBe(false);
  });
});

describe("isBoardFiltered / activeFilterCount", () => {
  it("reports an empty filter state as not filtered", () => {
    expect(isBoardFiltered(EMPTY_BOARD_FILTERS)).toBe(false);
    expect(activeFilterCount(EMPTY_BOARD_FILTERS)).toBe(0);
  });

  it("counts each active facet", () => {
    const f = filters({
      priority: "high",
      assignees: ["u1"],
      dueDate: "overdue",
    });
    expect(isBoardFiltered(f)).toBe(true);
    expect(activeFilterCount(f)).toBe(3);
  });

  it("search alone makes the board filtered but is not a facet", () => {
    const f = filters({ search: "abc" });
    expect(isBoardFiltered(f)).toBe(true);
    expect(activeFilterCount(f)).toBe(0);
  });
});

describe("applyBoardFilters", () => {
  it("returns every card when filters are empty", () => {
    const result = applyBoardFilters(makeBoard(), EMPTY_BOARD_FILTERS);
    expect(countBoardCards(result)).toBe(3);
  });

  it("keeps all columns even when a column ends up empty", () => {
    const result = applyBoardFilters(
      makeBoard(),
      filters({ search: "login" })
    );
    expect(result.columns).toHaveLength(2);
    expect(result.columns[0].cards.map((c) => c.id)).toEqual(["c1"]);
    expect(result.columns[1].cards).toHaveLength(0);
  });

  it("filters across columns by priority", () => {
    const result = applyBoardFilters(
      makeBoard(),
      filters({ priority: "critical" })
    );
    expect(countBoardCards(result)).toBe(1);
    expect(result.columns[1].cards[0].id).toBe("c3");
  });

  it("does not mutate the original board", () => {
    const board = makeBoard();
    applyBoardFilters(board, filters({ search: "login" }));
    expect(countBoardCards(board)).toBe(3);
  });
});

describe("priorityFilterLabel", () => {
  it("maps the 'all' token to a human label, not the raw value", () => {
    // Regression: the priority Select showed the raw value "all".
    expect(priorityFilterLabel("all")).toBe("Todas prioridades");
  });

  it("maps each priority to its accented pt-BR label", () => {
    expect(priorityFilterLabel("critical")).toBe("Crítico");
    expect(priorityFilterLabel("high")).toBe("Alta");
    expect(priorityFilterLabel("medium")).toBe("Média");
    expect(priorityFilterLabel("low")).toBe("Baixa");
  });
});

describe("countBoardCards", () => {
  it("sums cards across all columns", () => {
    expect(countBoardCards(makeBoard())).toBe(3);
  });

  it("returns 0 for a board with no cards", () => {
    const board = makeBoard();
    board.columns.forEach((col) => (col.cards = []));
    expect(countBoardCards(board)).toBe(0);
  });
});
