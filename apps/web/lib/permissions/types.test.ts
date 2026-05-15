import { describe, it, expect } from "vitest";
import { mapSectorRoleRow, type SectorRoleRow } from "./types";

function makeRow(overrides: Partial<SectorRoleRow> = {}): SectorRoleRow {
  return {
    sector_id: "sector-1",
    role_id: "role-1",
    sectors: { slug: "dev", name: "Desenvolvimento" },
    roles: {
      slug: "analyst",
      level: 50,
      role_permissions: [
        { permissions: { resource: "card", action: "create" } },
        { permissions: { resource: "card", action: "read" } },
      ],
    },
    ...overrides,
  };
}

describe("mapSectorRoleRow", () => {
  it("maps a raw row into the app-facing SectorRole shape", () => {
    const mapped = mapSectorRoleRow(makeRow());
    expect(mapped).toEqual({
      sectorId: "sector-1",
      sectorSlug: "dev",
      sectorName: "Desenvolvimento",
      roleId: "role-1",
      roleSlug: "analyst",
      roleLevel: 50,
      permissions: [
        { resource: "card", action: "create" },
        { resource: "card", action: "read" },
      ],
    });
  });

  it("drops null permission entries instead of crashing", () => {
    const row = makeRow({
      roles: {
        slug: "intern",
        level: 20,
        role_permissions: [
          { permissions: null },
          { permissions: { resource: "card", action: "read" } },
        ],
      },
    });
    const mapped = mapSectorRoleRow(row);
    expect(mapped.permissions).toEqual([
      { resource: "card", action: "read" },
    ]);
  });

  it("handles a role with no permissions", () => {
    const row = makeRow({
      roles: { slug: "intern", level: 20, role_permissions: [] },
    });
    expect(mapSectorRoleRow(row).permissions).toEqual([]);
  });
});
