import { describe, it, expect } from "vitest";
import { moveColumn } from "./board-columns-util";

const IDS = ["a", "b", "c", "d"];

describe("moveColumn", () => {
  it("moves a middle column left", () => {
    expect(moveColumn(IDS, "c", -1)).toEqual(["a", "c", "b", "d"]);
  });

  it("moves a middle column right", () => {
    expect(moveColumn(IDS, "b", 1)).toEqual(["a", "c", "b", "d"]);
  });

  it("returns null when moving the first column left", () => {
    expect(moveColumn(IDS, "a", -1)).toBeNull();
  });

  it("returns null when moving the last column right", () => {
    expect(moveColumn(IDS, "d", 1)).toBeNull();
  });

  it("returns null for an unknown column id", () => {
    expect(moveColumn(IDS, "z", 1)).toBeNull();
  });

  it("does not mutate the input array", () => {
    const input = [...IDS];
    moveColumn(input, "b", 1);
    expect(input).toEqual(IDS);
  });

  it("preserves the column set — a move is a swap, never a drop", () => {
    const result = moveColumn(IDS, "a", 1);
    expect(result).not.toBeNull();
    expect([...result!].sort()).toEqual([...IDS].sort());
    expect(result).toHaveLength(IDS.length);
  });

  it("handles a single-column board (no move possible)", () => {
    expect(moveColumn(["only"], "only", -1)).toBeNull();
    expect(moveColumn(["only"], "only", 1)).toBeNull();
  });
});
