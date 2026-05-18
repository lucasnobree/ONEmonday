import { describe, it, expect } from "vitest";
import {
  buildTree,
  topLevelIds,
  countNodes,
  allNodeIds,
  filterTreeByDepartment,
} from "./use-org-chart";
import type { Employee } from "./use-employees";

function emp(
  id: string,
  managerId: string | null,
  department: string | null = null
): Employee {
  return {
    id,
    sector_id: "sector-1",
    user_id: null,
    full_name: `Employee ${id}`,
    email: null,
    phone: null,
    position: "Cargo",
    department,
    hire_date: "2026-01-01",
    birth_date: null,
    manager_id: managerId,
    employment_type: "full_time",
    status: "active",
    termination_date: null,
    created_at: "2026-01-01",
  };
}

describe("buildTree", () => {
  it("nests reports under their manager", () => {
    const tree = buildTree([emp("ceo", null), emp("a", "ceo"), emp("b", "ceo")]);
    expect(tree).toHaveLength(1);
    expect(tree[0].employee.id).toBe("ceo");
    expect(tree[0].children.map((c) => c.employee.id).sort()).toEqual([
      "a",
      "b",
    ]);
  });

  it("treats employees with no manager as roots", () => {
    const tree = buildTree([emp("a", null), emp("b", null)]);
    expect(tree.map((n) => n.employee.id).sort()).toEqual(["a", "b"]);
  });

  it("treats an employee whose manager is absent as a root", () => {
    const tree = buildTree([emp("orphan", "missing-manager")]);
    expect(tree).toHaveLength(1);
    expect(tree[0].employee.id).toBe("orphan");
  });
});

describe("topLevelIds", () => {
  it("returns the first two levels so the chart is not collapsed on load", () => {
    const tree = buildTree([
      emp("ceo", null),
      emp("cto", "ceo"),
      emp("dev", "cto"),
    ]);
    const ids = topLevelIds(tree);
    expect(ids.has("ceo")).toBe(true);
    expect(ids.has("cto")).toBe(true);
    // Third level stays collapsed.
    expect(ids.has("dev")).toBe(false);
  });

  it("returns an empty set for an empty tree", () => {
    expect(topLevelIds([]).size).toBe(0);
  });
});

describe("countNodes", () => {
  it("counts every node across the whole forest", () => {
    const tree = buildTree([
      emp("ceo", null),
      emp("cto", "ceo"),
      emp("dev", "cto"),
      emp("solo", null),
    ]);
    expect(countNodes(tree)).toBe(4);
  });

  it("returns 0 for an empty tree", () => {
    expect(countNodes([])).toBe(0);
  });
});

describe("allNodeIds", () => {
  it("collects ids from every depth", () => {
    const tree = buildTree([
      emp("ceo", null),
      emp("cto", "ceo"),
      emp("dev", "cto"),
    ]);
    expect([...allNodeIds(tree)].sort()).toEqual(["ceo", "cto", "dev"]);
  });
});

describe("filterTreeByDepartment", () => {
  it("keeps ancestor managers so the hierarchy does not fragment", () => {
    // ceo (Diretoria) -> cto (Diretoria) -> dev (Engenharia)
    const tree = buildTree([
      emp("ceo", null, "Diretoria"),
      emp("cto", "ceo", "Diretoria"),
      emp("dev", "cto", "Engenharia"),
    ]);
    const { tree: filtered, matchedIds } = filterTreeByDepartment(
      tree,
      "Engenharia"
    );
    // The chart stays a single connected tree rooted at the CEO.
    expect(filtered).toHaveLength(1);
    expect(filtered[0].employee.id).toBe("ceo");
    expect(filtered[0].children[0].employee.id).toBe("cto");
    expect(filtered[0].children[0].children[0].employee.id).toBe("dev");
    // Only the real department member is reported as a match.
    expect(matchedIds.has("dev")).toBe(true);
    expect(matchedIds.has("ceo")).toBe(false);
    expect(matchedIds.has("cto")).toBe(false);
  });

  it("drops branches with no matching descendant", () => {
    const tree = buildTree([
      emp("ceo", null, "Diretoria"),
      emp("eng", "ceo", "Engenharia"),
      emp("sales", "ceo", "Vendas"),
    ]);
    const { tree: filtered } = filterTreeByDepartment(tree, "Engenharia");
    expect(filtered[0].children.map((c) => c.employee.id)).toEqual(["eng"]);
  });

  it("returns an empty tree when no node matches", () => {
    const tree = buildTree([emp("ceo", null, "Diretoria")]);
    const { tree: filtered, matchedIds } = filterTreeByDepartment(
      tree,
      "Engenharia"
    );
    expect(filtered).toHaveLength(0);
    expect(matchedIds.size).toBe(0);
  });
});
