import { describe, it, expect } from "vitest";
import {
  ALL_SECTORS,
  isAllSectors,
  scopeToSectorId,
  primarySectorId,
  resolveSectorScope,
} from "./sector-scope";
import type { SectorRole } from "@/lib/permissions/types";

/** Builds a minimal {@link SectorRole}, overridable per test. */
function role(overrides: Partial<SectorRole> = {}): SectorRole {
  return {
    sectorId: "sector-a",
    sectorSlug: "sector-a",
    sectorName: "Setor A",
    roleId: "role-1",
    roleSlug: "manager",
    roleLevel: 80,
    permissions: [],
    ...overrides,
  };
}

describe("isAllSectors", () => {
  it("is true only for the ALL_SECTORS sentinel", () => {
    expect(isAllSectors(ALL_SECTORS)).toBe(true);
    expect(isAllSectors("sector-a")).toBe(false);
  });
});

describe("scopeToSectorId", () => {
  it("maps the all-sectors sentinel to undefined (no sector_id filter)", () => {
    expect(scopeToSectorId(ALL_SECTORS)).toBeUndefined();
  });

  it("passes a concrete sector id through unchanged", () => {
    expect(scopeToSectorId("sector-x")).toBe("sector-x");
  });
});

describe("primarySectorId", () => {
  it("returns null when the user has no sector role", () => {
    expect(primarySectorId([])).toBeNull();
  });

  it("returns the only sector when the user has exactly one role", () => {
    expect(primarySectorId([role({ sectorId: "only" })])).toBe("only");
  });

  it("picks the first sector by name when the user has several roles", () => {
    const roles = [
      role({ sectorId: "z", sectorName: "Zeta" }),
      role({ sectorId: "a", sectorName: "Alfa" }),
      role({ sectorId: "m", sectorName: "Meta" }),
    ];
    expect(primarySectorId(roles)).toBe("a");
  });
});

describe("resolveSectorScope", () => {
  describe("non-admin (sector manager / individual contributor)", () => {
    it("is locked to the user's single sector, ignoring stored choice", () => {
      const scope = resolveSectorScope({
        isGlobalAdmin: false,
        sectorRoles: [role({ sectorId: "hr" })],
        // A stale stored choice from a previous admin session must not leak.
        storedScope: "finance",
        currentSectorId: "marketing",
      });
      expect(scope).toBe("hr");
    });

    it("is locked to the primary sector when the user has several", () => {
      const scope = resolveSectorScope({
        isGlobalAdmin: false,
        sectorRoles: [
          role({ sectorId: "z", sectorName: "Zeta" }),
          role({ sectorId: "a", sectorName: "Alfa" }),
        ],
        storedScope: ALL_SECTORS,
        currentSectorId: null,
      });
      expect(scope).toBe("a");
    });

    it("can never widen scope to all-sectors", () => {
      const scope = resolveSectorScope({
        isGlobalAdmin: false,
        sectorRoles: [role({ sectorId: "support" })],
        storedScope: ALL_SECTORS,
        currentSectorId: null,
      });
      expect(scope).not.toBe(ALL_SECTORS);
      expect(scope).toBe("support");
    });

    it("falls back to all-sectors only when the user has no role at all", () => {
      const scope = resolveSectorScope({
        isGlobalAdmin: false,
        sectorRoles: [],
        storedScope: null,
        currentSectorId: null,
      });
      expect(scope).toBe(ALL_SECTORS);
    });
  });

  describe("global admin", () => {
    it("honours the admin's stored choice over the sidebar sector", () => {
      const scope = resolveSectorScope({
        isGlobalAdmin: true,
        sectorRoles: [],
        storedScope: "finance",
        currentSectorId: "marketing",
      });
      expect(scope).toBe("finance");
    });

    it("honours a stored all-sectors choice", () => {
      const scope = resolveSectorScope({
        isGlobalAdmin: true,
        sectorRoles: [],
        storedScope: ALL_SECTORS,
        currentSectorId: "marketing",
      });
      expect(scope).toBe(ALL_SECTORS);
    });

    it("defaults to the sidebar's current sector when no choice is stored", () => {
      const scope = resolveSectorScope({
        isGlobalAdmin: true,
        sectorRoles: [],
        storedScope: null,
        currentSectorId: "marketing",
      });
      expect(scope).toBe("marketing");
    });

    it("defaults to all-sectors when nothing is stored and no sidebar sector", () => {
      const scope = resolveSectorScope({
        isGlobalAdmin: true,
        sectorRoles: [],
        storedScope: null,
        currentSectorId: null,
      });
      expect(scope).toBe(ALL_SECTORS);
    });
  });
});
