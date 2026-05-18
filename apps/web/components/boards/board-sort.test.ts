import { describe, it, expect } from "vitest";
import { sortBoards, filterBoards } from "./board-sort";
import type { BoardSummary } from "@/hooks/use-boards";

function makeBoard(
  id: string,
  name: string,
  created_at: string,
  updated_at: string | null
): BoardSummary {
  return {
    id,
    name,
    description: null,
    visibility: "sector",
    is_default: false,
    created_by: "u1",
    is_active: true,
    created_at,
    updated_at,
  };
}

const boards: BoardSummary[] = [
  makeBoard("a", "Zebra", "2026-01-01", "2026-05-10"),
  makeBoard("b", "alfa", "2026-03-01", "2026-05-01"),
  makeBoard("c", "Mike", "2026-02-01", null),
];

describe("sortBoards", () => {
  it("sorts by name case-insensitively", () => {
    expect(sortBoards(boards, "name").map((b) => b.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("sorts by creation date, newest first", () => {
    expect(sortBoards(boards, "created").map((b) => b.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("sorts by recency, falling back to created_at when updated_at is null", () => {
    expect(sortBoards(boards, "recent").map((b) => b.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [...boards];
    sortBoards(input, "name");
    expect(input.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });
});

describe("filterBoards", () => {
  it("returns every board for an empty query", () => {
    expect(filterBoards(boards, "  ")).toHaveLength(3);
  });

  it("matches a case-insensitive substring of the name", () => {
    expect(filterBoards(boards, "MIK").map((b) => b.id)).toEqual(["c"]);
  });
});
