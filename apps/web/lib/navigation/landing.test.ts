import { describe, it, expect } from "vitest";
import {
  resolveLanding,
  isManagerialRole,
  MANAGER_ROLE_LEVEL,
} from "./landing";
import type { SectorRole } from "@/lib/permissions/types";

function role(partial: Partial<SectorRole>): SectorRole {
  return {
    sectorId: "s1",
    sectorSlug: "s1",
    sectorName: "Setor 1",
    roleId: "r1",
    roleSlug: "analyst",
    roleLevel: 50,
    permissions: [],
    ...partial,
  };
}

describe("isManagerialRole", () => {
  it("treats a manager-level role (80) as managerial", () => {
    expect(isManagerialRole(role({ roleLevel: MANAGER_ROLE_LEVEL }))).toBe(true);
  });

  it("treats a role above the threshold as managerial", () => {
    expect(isManagerialRole(role({ roleLevel: 100 }))).toBe(true);
  });

  it("treats analyst (50) and intern (20) as non-managerial", () => {
    expect(isManagerialRole(role({ roleLevel: 50 }))).toBe(false);
    expect(isManagerialRole(role({ roleLevel: 20 }))).toBe(false);
  });
});

describe("resolveLanding", () => {
  it("routes a global admin to the overview", () => {
    expect(resolveLanding(true, [])).toEqual({
      target: "overview",
      sector: null,
    });
  });

  it("prefers overview for an admin even with sector roles", () => {
    expect(
      resolveLanding(true, [role({ roleLevel: 80 })]).target
    ).toBe("overview");
  });

  it("routes a sector manager to their sector dashboard", () => {
    const decision = resolveLanding(false, [
      role({
        sectorId: "sec-a",
        sectorSlug: "a",
        sectorName: "Alpha",
        roleSlug: "manager",
        roleLevel: 80,
      }),
    ]);
    expect(decision.target).toBe("sector-dashboard");
    expect(decision.sector).toEqual({ id: "sec-a", slug: "a", name: "Alpha" });
  });

  it("picks the first managerial sector by name when several exist", () => {
    const decision = resolveLanding(false, [
      role({ sectorId: "z", sectorName: "Zeta", roleLevel: 80 }),
      role({ sectorId: "b", sectorName: "Beta", roleLevel: 80 }),
    ]);
    expect(decision.sector?.id).toBe("b");
  });

  it("ignores non-managerial roles when choosing the manager sector", () => {
    const decision = resolveLanding(false, [
      role({ sectorId: "ic", sectorName: "Alpha", roleLevel: 50 }),
      role({ sectorId: "mgr", sectorName: "Omega", roleLevel: 80 }),
    ]);
    expect(decision.target).toBe("sector-dashboard");
    expect(decision.sector?.id).toBe("mgr");
  });

  it("routes an individual contributor to my-work", () => {
    expect(
      resolveLanding(false, [role({ roleLevel: 50 })]).target
    ).toBe("my-work");
  });

  it("routes a user with no roles to my-work", () => {
    expect(resolveLanding(false, [])).toEqual({
      target: "my-work",
      sector: null,
    });
  });
});
