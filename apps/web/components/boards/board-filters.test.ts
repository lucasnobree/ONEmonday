import { describe, it, expect } from "vitest";
import {
  cardMatchesFilters,
  applyBoardFilters,
  countBoardCards,
  priorityFilterLabel,
  EMPTY_BOARD_FILTERS,
} from "./board-filters";
import type { BoardCard, BoardData } from "@/hooks/use-board-data";

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
    expect(
      cardMatchesFilters(card, { search: "login", priority: "all" })
    ).toBe(true);
  });

  it("rejects a card whose title does not contain the query", () => {
    expect(
      cardMatchesFilters(card, { search: "deploy", priority: "all" })
    ).toBe(false);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(
      cardMatchesFilters(card, { search: "  login  ", priority: "all" })
    ).toBe(true);
  });

  it("filters by exact priority", () => {
    expect(
      cardMatchesFilters(card, { search: "", priority: "high" })
    ).toBe(true);
    expect(
      cardMatchesFilters(card, { search: "", priority: "low" })
    ).toBe(false);
  });

  it("requires both search and priority to match", () => {
    expect(
      cardMatchesFilters(card, { search: "login", priority: "low" })
    ).toBe(false);
  });
});

describe("applyBoardFilters", () => {
  it("returns every card when filters are empty", () => {
    const result = applyBoardFilters(makeBoard(), EMPTY_BOARD_FILTERS);
    expect(countBoardCards(result)).toBe(3);
  });

  it("keeps all columns even when a column ends up empty", () => {
    const result = applyBoardFilters(makeBoard(), {
      search: "login",
      priority: "all",
    });
    expect(result.columns).toHaveLength(2);
    expect(result.columns[0].cards.map((c) => c.id)).toEqual(["c1"]);
    expect(result.columns[1].cards).toHaveLength(0);
  });

  it("filters across columns by priority", () => {
    const result = applyBoardFilters(makeBoard(), {
      search: "",
      priority: "critical",
    });
    expect(countBoardCards(result)).toBe(1);
    expect(result.columns[1].cards[0].id).toBe("c3");
  });

  it("does not mutate the original board", () => {
    const board = makeBoard();
    applyBoardFilters(board, { search: "login", priority: "all" });
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
