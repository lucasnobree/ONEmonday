import { describe, it, expect } from "vitest";
import { buildTree, topLevelIds } from "./use-org-chart";
import type { Employee } from "./use-employees";

function emp(id: string, managerId: string | null): Employee {
  return {
    id,
    sector_id: "sector-1",
    user_id: null,
    full_name: `Employee ${id}`,
    email: null,
    phone: null,
    position: "Cargo",
    department: null,
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
