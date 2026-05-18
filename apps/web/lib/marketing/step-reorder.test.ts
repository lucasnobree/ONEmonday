import { describe, it, expect } from "vitest";
import { moveItemUp, moveItemDown } from "./step-reorder";

describe("moveItemUp", () => {
  it("swaps an item with its predecessor", () => {
    expect(moveItemUp(["a", "b", "c"], 1)).toEqual(["b", "a", "c"]);
  });

  it("moves the last item up by one", () => {
    expect(moveItemUp(["a", "b", "c"], 2)).toEqual(["a", "c", "b"]);
  });

  it("is a no-op for the first item", () => {
    expect(moveItemUp(["a", "b", "c"], 0)).toEqual(["a", "b", "c"]);
  });

  it("is a no-op for an out-of-range index", () => {
    expect(moveItemUp(["a", "b"], 5)).toEqual(["a", "b"]);
    expect(moveItemUp(["a", "b"], -1)).toEqual(["a", "b"]);
  });

  it("does not mutate the input array", () => {
    const input = ["a", "b", "c"];
    moveItemUp(input, 2);
    expect(input).toEqual(["a", "b", "c"]);
  });
});

describe("moveItemDown", () => {
  it("swaps an item with its successor", () => {
    expect(moveItemDown(["a", "b", "c"], 1)).toEqual(["a", "c", "b"]);
  });

  it("moves the first item down by one", () => {
    expect(moveItemDown(["a", "b", "c"], 0)).toEqual(["b", "a", "c"]);
  });

  it("is a no-op for the last item", () => {
    expect(moveItemDown(["a", "b", "c"], 2)).toEqual(["a", "b", "c"]);
  });

  it("is a no-op for an out-of-range index", () => {
    expect(moveItemDown(["a", "b"], 5)).toEqual(["a", "b"]);
    expect(moveItemDown(["a", "b"], -1)).toEqual(["a", "b"]);
  });

  it("does not mutate the input array", () => {
    const input = ["a", "b", "c"];
    moveItemDown(input, 0);
    expect(input).toEqual(["a", "b", "c"]);
  });

  it("round-trips: down then up restores order", () => {
    const start = ["a", "b", "c", "d"];
    expect(moveItemUp(moveItemDown(start, 1), 2)).toEqual(start);
  });
});
