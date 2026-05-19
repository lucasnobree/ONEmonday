import { describe, it, expect } from "vitest";
import {
  isScopeReady,
  shouldFilterBySector,
  sectorFilterValue,
  rpcSectorParam,
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

describe("rpcSectorParam", () => {
  it("is undefined while the scope is still unresolved", () => {
    // The hook's early-return / disabled guard keeps the RPC from firing.
    expect(rpcSectorParam(undefined)).toBeUndefined();
  });

  it("is null for the all-sectors sentinel — RPC takes its aggregate branch", () => {
    // Distinct from sectorFilterValue (undefined): the dashboard RPCs need an
    // explicit null so p_sector_id IS NULL selects the cross-sector aggregate.
    expect(rpcSectorParam(ALL_SECTORS)).toBeNull();
  });

  it("is the concrete sector id for a single-sector scope", () => {
    expect(rpcSectorParam("sector-a")).toBe("sector-a");
  });

  it("never collapses all-sectors to undefined (regression for empty KPIs)", () => {
    // Phase 2b bug: hooks used sectorFilterValue, so all-sectors became
    // undefined and the dashboard short-circuited to an empty result instead
    // of aggregating. rpcSectorParam must keep all-sectors distinguishable.
    expect(rpcSectorParam(ALL_SECTORS)).not.toBeUndefined();
  });
});
