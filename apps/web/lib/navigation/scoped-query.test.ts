import { describe, it, expect } from "vitest";
import {
  isScopeReady,
  shouldFilterBySector,
  sectorFilterValue,
  resolveTargetSector,
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

describe("resolveTargetSector", () => {
  it("uses the edited record's own sector first — editing never moves sectors", () => {
    // Even under the all-sectors scope, an edited record keeps its sector.
    expect(
      resolveTargetSector(ALL_SECTORS, "sidebar-sector", "record-sector")
    ).toBe("record-sector");
    // And it wins over a different concrete scope too.
    expect(
      resolveTargetSector("scope-sector", "sidebar-sector", "record-sector")
    ).toBe("record-sector");
  });

  it("uses the scope's concrete sector for a new record", () => {
    expect(resolveTargetSector("scope-sector", "sidebar-sector")).toBe(
      "scope-sector"
    );
    // The scope wins over the sidebar when both are present.
    expect(resolveTargetSector("scope-sector", "sidebar-sector", null)).toBe(
      "scope-sector"
    );
  });

  it("falls back to the sidebar's current sector under the all-sectors scope", () => {
    expect(resolveTargetSector(ALL_SECTORS, "sidebar-sector")).toBe(
      "sidebar-sector"
    );
    expect(resolveTargetSector(ALL_SECTORS, "sidebar-sector", null)).toBe(
      "sidebar-sector"
    );
  });

  it("is null when no target sector can be resolved — create stays disabled", () => {
    expect(resolveTargetSector(ALL_SECTORS, null)).toBeNull();
    expect(resolveTargetSector(ALL_SECTORS, undefined)).toBeNull();
    expect(resolveTargetSector(ALL_SECTORS, null, null)).toBeNull();
  });
});
