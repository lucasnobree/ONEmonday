import { describe, it, expect } from "vitest";
import {
  ensureExpanded,
  parseExpandedState,
  serializeExpandedState,
  toggleExpanded,
} from "./expansion-state";

describe("parseExpandedState", () => {
  it("returns an empty set for a null value", () => {
    expect(parseExpandedState(null).size).toBe(0);
  });

  it("parses a persisted id array", () => {
    const set = parseExpandedState('["a","b"]');
    expect([...set].sort()).toEqual(["a", "b"]);
  });

  it("tolerates corrupt JSON", () => {
    expect(parseExpandedState("{not json").size).toBe(0);
  });

  it("ignores non-array JSON", () => {
    expect(parseExpandedState('{"a":1}').size).toBe(0);
  });

  it("drops non-string entries", () => {
    const set = parseExpandedState('["a",1,null,"b"]');
    expect([...set].sort()).toEqual(["a", "b"]);
  });
});

describe("serializeExpandedState", () => {
  it("round-trips through parseExpandedState", () => {
    const original = new Set(["x", "y", "z"]);
    expect(parseExpandedState(serializeExpandedState(original))).toEqual(
      original
    );
  });

  it("produces a stable, sorted string", () => {
    expect(serializeExpandedState(new Set(["b", "a"]))).toBe(
      serializeExpandedState(new Set(["a", "b"]))
    );
  });
});

describe("toggleExpanded", () => {
  it("adds an id that is not present", () => {
    expect(toggleExpanded(new Set(), "a").has("a")).toBe(true);
  });

  it("removes an id that is present", () => {
    expect(toggleExpanded(new Set(["a"]), "a").has("a")).toBe(false);
  });

  it("does not mutate the input set", () => {
    const input = new Set(["a"]);
    toggleExpanded(input, "b");
    expect(input.has("b")).toBe(false);
  });
});

describe("ensureExpanded", () => {
  it("adds missing ids", () => {
    const result = ensureExpanded(new Set(["a"]), ["b", "c"]);
    expect([...result].sort()).toEqual(["a", "b", "c"]);
  });

  it("returns the same reference when nothing changes", () => {
    // Reference equality lets callers skip redundant state updates.
    const input = new Set(["a", "b"]);
    expect(ensureExpanded(input, ["a", "b"])).toBe(input);
  });

  it("ignores null and undefined ids", () => {
    const input = new Set(["a"]);
    expect(ensureExpanded(input, [null, undefined])).toBe(input);
  });

  it("never collapses an already-expanded id", () => {
    const result = ensureExpanded(new Set(["a", "b"]), ["c"]);
    expect(result.has("a")).toBe(true);
    expect(result.has("b")).toBe(true);
  });
});
