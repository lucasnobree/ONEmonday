import { describe, it, expect } from "vitest";
import {
  MODULE_CATALOG,
  buildSectorTree,
  findActiveBranch,
  isSubPageActive,
  visibleSectors,
  type NavSector,
} from "./sector-tree";

const SECTOR_A: NavSector = { id: "a", slug: "comercial", name: "Comercial" };
const SECTOR_B: NavSector = { id: "b", slug: "suporte", name: "Suporte" };
const SECTOR_C: NavSector = { id: "c", slug: "dev", name: "Desenvolvimento" };

describe("visibleSectors", () => {
  it("gives a global admin every sector", () => {
    const result = visibleSectors(true, [], [SECTOR_A, SECTOR_B]);
    expect(result.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("gives a non-admin only the sectors in their roles", () => {
    const result = visibleSectors(
      false,
      [{ sectorId: "b", sectorSlug: "suporte", sectorName: "Suporte" }],
      [SECTOR_A, SECTOR_B, SECTOR_C]
    );
    expect(result.map((s) => s.id)).toEqual(["b"]);
  });

  it("ignores the all-sectors list for a non-admin", () => {
    // A non-admin must never see sectors outside their roles, even if the
    // account-wide list is populated.
    const result = visibleSectors(false, [], [SECTOR_A, SECTOR_B]);
    expect(result).toHaveLength(0);
  });

  it("de-duplicates a sector granted by multiple roles", () => {
    const result = visibleSectors(
      false,
      [
        { sectorId: "a", sectorSlug: "comercial", sectorName: "Comercial" },
        { sectorId: "a", sectorSlug: "comercial", sectorName: "Comercial" },
      ],
      []
    );
    expect(result).toHaveLength(1);
  });

  it("sorts sectors by name for a stable tree order", () => {
    const result = visibleSectors(true, [], [SECTOR_B, SECTOR_C, SECTOR_A]);
    expect(result.map((s) => s.name)).toEqual([
      "Comercial",
      "Desenvolvimento",
      "Suporte",
    ]);
  });
});

describe("buildSectorTree", () => {
  it("materialises every module of the catalogue under each sector", () => {
    const tree = buildSectorTree([SECTOR_A, SECTOR_B]);
    expect(tree).toHaveLength(2);
    for (const node of tree) {
      expect(node.modules.map((m) => m.id)).toEqual(
        MODULE_CATALOG.map((m) => m.id)
      );
    }
  });

  it("prepends the sector slug to sector-scoped Boards sub-pages", () => {
    const [node] = buildSectorTree([SECTOR_A]);
    const boards = node.modules.find((m) => m.id === "boards");
    expect(boards?.subPages.map((s) => s.href)).toEqual([
      "/comercial/boards",
      "/comercial/projects",
    ]);
  });

  it("keeps global module sub-pages as absolute URLs regardless of sector", () => {
    const [a] = buildSectorTree([SECTOR_A]);
    const [b] = buildSectorTree([SECTOR_B]);
    const crmA = a.modules.find((m) => m.id === "crm");
    const crmB = b.modules.find((m) => m.id === "crm");
    expect(crmA?.subPages.find((s) => s.id === "crm-leads")?.href).toBe(
      "/crm/leads"
    );
    // Same global URL under a different sector branch.
    expect(crmB?.subPages.find((s) => s.id === "crm-leads")?.href).toBe(
      "/crm/leads"
    );
  });

  it("exposes the documented CRM sub-page set", () => {
    const [node] = buildSectorTree([SECTOR_A]);
    const crm = node.modules.find((m) => m.id === "crm");
    expect(crm?.subPages.map((s) => s.href)).toEqual([
      "/crm",
      "/crm/leads",
      "/crm/forms",
      "/crm/pipeline",
      "/crm/proposals",
      "/crm/contacts",
      "/crm/companies",
      "/crm/activities",
    ]);
  });
});

describe("isSubPageActive", () => {
  it("matches an exact pathname", () => {
    expect(isSubPageActive("/crm/leads", "/crm/leads")).toBe(true);
  });

  it("matches a nested route under the sub-page", () => {
    expect(isSubPageActive("/crm/leads", "/crm/leads/123")).toBe(true);
  });

  it("matches a module overview against its own children (prefix matcher)", () => {
    // isSubPageActive is a plain prefix test; disambiguation between
    // "/crm" and "/crm/leads" is findActiveBranch's job, not this one's.
    expect(isSubPageActive("/crm", "/crm/leads")).toBe(true);
  });

  it("does not match an unrelated path with a shared prefix", () => {
    expect(isSubPageActive("/crm", "/crmx")).toBe(false);
  });

  it("matches sector-scoped board routes", () => {
    expect(
      isSubPageActive("/comercial/boards", "/comercial/boards/abc")
    ).toBe(true);
  });
});

describe("findActiveBranch", () => {
  const tree = buildSectorTree([SECTOR_A, SECTOR_B]);

  it("locates a global sub-page branch", () => {
    const branch = findActiveBranch(tree, "/crm/leads");
    // Global modules attach to the first matching sector branch.
    expect(branch.moduleId).toBe("crm");
    expect(branch.subPageId).toBe("crm-leads");
    expect(branch.sectorId).not.toBeNull();
  });

  it("prefers the most specific (longest) matching sub-page", () => {
    // Both "/crm" and "/crm/leads" could be candidates for "/crm/leads";
    // the deeper one must win so the correct node highlights.
    const branch = findActiveBranch(tree, "/crm/leads");
    expect(branch.subPageId).toBe("crm-leads");
  });

  it("matches the module overview on its exact route", () => {
    const branch = findActiveBranch(tree, "/crm");
    expect(branch.subPageId).toBe("crm-overview");
  });

  it("resolves a sector-scoped board route to the right sector", () => {
    const branch = findActiveBranch(tree, "/suporte/boards");
    expect(branch.sectorId).toBe("b");
    expect(branch.moduleId).toBe("boards");
    expect(branch.subPageId).toBe("boards-quadros");
  });

  it("attaches a global URL to the preferred sector branch when given", () => {
    // "/crm/leads" exists identically under sectors A and B; the user's
    // current sector (B) must win so the right branch highlights.
    const branch = findActiveBranch(tree, "/crm/leads", "b");
    expect(branch.sectorId).toBe("b");
    expect(branch.subPageId).toBe("crm-leads");
  });

  it("falls back to the first sector branch without a preference", () => {
    const branch = findActiveBranch(tree, "/crm/leads");
    expect(branch.sectorId).toBe("a");
  });

  it("ignores an unknown preferred sector id", () => {
    const branch = findActiveBranch(tree, "/crm/leads", "does-not-exist");
    expect(branch.sectorId).toBe("a");
  });

  it("returns a null branch when the pathname is outside the tree", () => {
    const branch = findActiveBranch(tree, "/settings/profile");
    expect(branch).toEqual({
      sectorId: null,
      moduleId: null,
      subPageId: null,
    });
  });
});
