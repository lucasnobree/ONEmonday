import { describe, it, expect } from "vitest";
import { normalizeShortcut, formatShortcut } from "./shortcut";

describe("normalizeShortcut", () => {
  it("strips a single leading slash", () => {
    expect(normalizeShortcut("/escalar")).toBe("escalar");
  });

  it("strips multiple leading slashes (the //escalar bug)", () => {
    expect(normalizeShortcut("//escalar")).toBe("escalar");
    expect(normalizeShortcut("///followup")).toBe("followup");
  });

  it("leaves a bare token untouched", () => {
    expect(normalizeShortcut("escalar")).toBe("escalar");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeShortcut("  /escalar  ")).toBe("escalar");
  });

  it("returns undefined for empty, slash-only or nullish input", () => {
    expect(normalizeShortcut("")).toBeUndefined();
    expect(normalizeShortcut("   ")).toBeUndefined();
    expect(normalizeShortcut("/")).toBeUndefined();
    expect(normalizeShortcut("//")).toBeUndefined();
    expect(normalizeShortcut(null)).toBeUndefined();
    expect(normalizeShortcut(undefined)).toBeUndefined();
  });

  it("does not strip slashes that are not leading", () => {
    expect(normalizeShortcut("foo/bar")).toBe("foo/bar");
  });
});

describe("formatShortcut", () => {
  it("renders exactly one leading slash for a bare token", () => {
    expect(formatShortcut("escalar")).toBe("/escalar");
  });

  it("renders exactly one leading slash for a legacy slash-prefixed value", () => {
    expect(formatShortcut("/escalar")).toBe("/escalar");
    expect(formatShortcut("//escalar")).toBe("/escalar");
  });

  it("returns an empty string for nullish or empty input", () => {
    expect(formatShortcut(null)).toBe("");
    expect(formatShortcut(undefined)).toBe("");
    expect(formatShortcut("")).toBe("");
    expect(formatShortcut("/")).toBe("");
  });
});
