import { describe, it, expect } from "vitest";
import { nextSortState, sortRows, type SortState } from "./list-sort";

type Row = { name: string; count: number | null; flag: boolean };

const rows: Row[] = [
  { name: "Charlie", count: 3, flag: true },
  { name: "alpha", count: null, flag: false },
  { name: "Bravo", count: 1, flag: true },
];

const accessor = (row: Row, key: "name" | "count" | "flag") => row[key];

describe("nextSortState", () => {
  it("selects a new column ascending", () => {
    const start: SortState<"name" | "count"> = {
      key: "name",
      direction: "desc",
    };
    expect(nextSortState(start, "count")).toEqual({
      key: "count",
      direction: "asc",
    });
  });

  it("flips direction when the same column is clicked", () => {
    const start: SortState<"name"> = { key: "name", direction: "asc" };
    expect(nextSortState(start, "name").direction).toBe("desc");
    expect(nextSortState(nextSortState(start, "name"), "name").direction).toBe(
      "asc"
    );
  });
});

describe("sortRows", () => {
  it("sorts strings case-insensitively in pt-BR locale", () => {
    const sorted = sortRows(rows, { key: "name", direction: "asc" }, accessor);
    expect(sorted.map((r) => r.name)).toEqual(["alpha", "Bravo", "Charlie"]);
  });

  it("sorts numbers ascending", () => {
    const sorted = sortRows(rows, { key: "count", direction: "asc" }, accessor);
    // null sinks to the bottom; 1 then 3 above it.
    expect(sorted.map((r) => r.count)).toEqual([1, 3, null]);
  });

  it("keeps nulls at the bottom even when descending", () => {
    const sorted = sortRows(rows, { key: "count", direction: "desc" }, accessor);
    expect(sorted.map((r) => r.count)).toEqual([3, 1, null]);
  });

  it("does not mutate the input array", () => {
    const before = [...rows];
    sortRows(rows, { key: "name", direction: "desc" }, accessor);
    expect(rows).toEqual(before);
  });

  it("orders booleans true-first when ascending", () => {
    const sorted = sortRows(rows, { key: "flag", direction: "asc" }, accessor);
    expect(sorted.map((r) => r.flag)).toEqual([true, true, false]);
  });
});
