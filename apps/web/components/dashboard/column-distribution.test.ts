import { describe, it, expect } from "vitest";
import { collapseColumns } from "./column-distribution";

function col(name: string, count: number) {
  return { column_name: name, column_color: "#000000", count };
}

describe("collapseColumns", () => {
  it("returns the list unchanged when within the cap", () => {
    const data = [col("A fazer", 5), col("Feito", 3)];
    expect(collapseColumns(data)).toEqual(data);
  });

  it("returns the list unchanged at exactly the cap of 8", () => {
    const data = Array.from({ length: 8 }, (_, i) => col(`C${i}`, i));
    expect(collapseColumns(data)).toHaveLength(8);
  });

  it("folds the overflow into a single 'Outros' bucket", () => {
    const data = Array.from({ length: 12 }, (_, i) => col(`C${i}`, i + 1));
    const result = collapseColumns(data);

    expect(result).toHaveLength(9);
    const outros = result[result.length - 1];
    expect(outros.column_name).toBe("Outros");
    // Lowest 4 counts (1 + 2 + 3 + 4) fold into "Outros".
    expect(outros.count).toBe(10);
  });

  it("keeps the highest-count columns visible", () => {
    const data = Array.from({ length: 10 }, (_, i) => col(`C${i}`, i + 1));
    const result = collapseColumns(data);
    const visibleNames = result.slice(0, 8).map((d) => d.column_name);

    // C9 (count 10) and C8 (count 9) are the largest and must survive.
    expect(visibleNames).toContain("C9");
    expect(visibleNames).toContain("C8");
    expect(visibleNames).not.toContain("C0");
  });

  it("preserves the grand total across the fold", () => {
    const data = Array.from({ length: 15 }, (_, i) => col(`C${i}`, i + 1));
    const before = data.reduce((s, d) => s + d.count, 0);
    const after = collapseColumns(data).reduce((s, d) => s + d.count, 0);
    expect(after).toBe(before);
  });

  it("does not mutate the input array", () => {
    const data = Array.from({ length: 10 }, (_, i) => col(`C${i}`, i));
    const snapshot = [...data];
    collapseColumns(data);
    expect(data).toEqual(snapshot);
  });
});
