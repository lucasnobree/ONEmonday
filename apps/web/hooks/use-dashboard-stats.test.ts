import { describe, it, expect } from "vitest";
import { buildCardsByColumn, type ColumnMeta } from "./use-dashboard-stats";

const COLUMNS: ColumnMeta[] = [
  { id: "c1", name: "A Fazer", color: "#94a3b8" },
  { id: "c2", name: "Em Progresso", color: "#3b82f6" },
  { id: "c3", name: "Concluido", color: null },
];

describe("buildCardsByColumn", () => {
  it("resolves column name and colour from the metadata list", () => {
    const counts = new Map([
      ["c1", 3],
      ["c2", 5],
    ]);
    const result = buildCardsByColumn(counts, COLUMNS);
    expect(result).toEqual([
      { column_name: "A Fazer", column_color: "#94a3b8", count: 3 },
      { column_name: "Em Progresso", column_color: "#3b82f6", count: 5 },
    ]);
  });

  it("falls back to a default colour when the column colour is null", () => {
    const result = buildCardsByColumn(new Map([["c3", 2]]), COLUMNS);
    expect(result).toEqual([
      { column_name: "Concluido", column_color: "#6b7280", count: 2 },
    ]);
  });

  it("folds counts for unresolved columns into an 'Outros' bucket", () => {
    // Regression: the column chart used a board_columns!inner join that RLS
    // silently emptied for sector managers. Counts must never be dropped.
    const counts = new Map([
      ["c1", 4],
      ["unknown", 6],
    ]);
    const result = buildCardsByColumn(counts, COLUMNS);
    expect(result).toContainEqual({
      column_name: "A Fazer",
      column_color: "#94a3b8",
      count: 4,
    });
    expect(result).toContainEqual({
      column_name: "Outros",
      column_color: "#6b7280",
      count: 6,
    });
    const total = result.reduce((sum, r) => sum + r.count, 0);
    expect(total).toBe(10);
  });

  it("merges columns that share a name across boards", () => {
    const columns: ColumnMeta[] = [
      { id: "a", name: "A Fazer", color: "#94a3b8" },
      { id: "b", name: "A Fazer", color: "#94a3b8" },
    ];
    const result = buildCardsByColumn(
      new Map([
        ["a", 2],
        ["b", 3],
      ]),
      columns
    );
    expect(result).toEqual([
      { column_name: "A Fazer", column_color: "#94a3b8", count: 5 },
    ]);
  });

  it("ignores zero and negative counts", () => {
    const result = buildCardsByColumn(
      new Map([
        ["c1", 0],
        ["c2", 3],
      ]),
      COLUMNS
    );
    expect(result).toEqual([
      { column_name: "Em Progresso", column_color: "#3b82f6", count: 3 },
    ]);
  });

  it("returns an empty array when there are no cards", () => {
    expect(buildCardsByColumn(new Map(), COLUMNS)).toEqual([]);
  });
});
