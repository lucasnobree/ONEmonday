import { describe, it, expect } from "vitest";
import {
  isScopeReady,
  shouldFilterBySector,
  sectorFilterValue,
} from "./scoped-query";
import { ALL_SECTORS } from "./sector-scope";

describe("isScopeReady", () => {
  it("is false while the scope is still unresolved (undefined)", () => {
    expect(isScopeReady(undefined)).toBe(false);
  });

  it("is true for a concrete sector id", () => {
    expect(isScopeReady("sector-a")).toBe(true);
  });

  it("is true for the all-sectors sentinel", () => {
    expect(isScopeReady(ALL_SECTORS)).toBe(true);
  });
});

describe("shouldFilterBySector", () => {
  it("is false for the all-sectors sentinel (cross-sector query)", () => {
    expect(shouldFilterBySector(ALL_SECTORS)).toBe(false);
  });

  it("is true for a concrete sector id", () => {
    expect(shouldFilterBySector("sector-a")).toBe(true);
  });
});

describe("sectorFilterValue", () => {
  it("is undefined for the all-sectors sentinel — no .eq clause is added", () => {
    expect(sectorFilterValue(ALL_SECTORS)).toBeUndefined();
  });

  it("is the concrete sector id otherwise", () => {
    expect(sectorFilterValue("sector-a")).toBe("sector-a");
  });
});
