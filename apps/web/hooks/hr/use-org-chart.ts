"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Employee } from "@/hooks/hr/use-employees";

export interface OrgNode {
  employee: Employee;
  children: OrgNode[];
}

export function buildTree(employees: Employee[]): OrgNode[] {
  const map = new Map<string, OrgNode>();
  employees.forEach((emp) => {
    map.set(emp.id, { employee: emp, children: [] });
  });

  const roots: OrgNode[] = [];

  employees.forEach((emp) => {
    const node = map.get(emp.id)!;
    if (emp.manager_id && map.has(emp.manager_id)) {
      map.get(emp.manager_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

/**
 * Ids of the top two levels of an org tree. The chart expands these by default
 * so it never renders as a single collapsed row.
 */
export function topLevelIds(tree: OrgNode[]): Set<string> {
  const ids = new Set<string>();
  tree.forEach((root) => {
    ids.add(root.employee.id);
    root.children.forEach((child) => ids.add(child.employee.id));
  });
  return ids;
}

/** Total number of nodes across the whole forest. */
export function countNodes(tree: OrgNode[]): number {
  return tree.reduce(
    (sum, node) => sum + 1 + countNodes(node.children),
    0
  );
}

/** Every node id in the forest — used by "expandir tudo". */
export function allNodeIds(tree: OrgNode[]): Set<string> {
  const ids = new Set<string>();
  const walk = (nodes: OrgNode[]) => {
    nodes.forEach((node) => {
      ids.add(node.employee.id);
      walk(node.children);
    });
  };
  walk(tree);
  return ids;
}

/**
 * Filter the org tree to a department **without fragmenting the hierarchy**.
 *
 * The audit defect: filtering by department before building the tree drops
 * managers in other departments, so every employee whose manager is outside
 * the department becomes an orphan root. Instead we keep a node when it — or
 * any of its descendants — matches the department, so ancestor managers are
 * retained and the chart stays a single connected tree.
 *
 * Returns the matching ids separately so the UI can visually highlight the
 * true matches versus the ancestors that are only kept for structure.
 */
export function filterTreeByDepartment(
  tree: OrgNode[],
  department: string
): { tree: OrgNode[]; matchedIds: Set<string> } {
  const matchedIds = new Set<string>();

  function prune(nodes: OrgNode[]): OrgNode[] {
    const kept: OrgNode[] = [];
    for (const node of nodes) {
      const prunedChildren = prune(node.children);
      const selfMatches = node.employee.department === department;
      if (selfMatches) matchedIds.add(node.employee.id);
      if (selfMatches || prunedChildren.length > 0) {
        kept.push({ employee: node.employee, children: prunedChildren });
      }
    }
    return kept;
  }

  return { tree: prune(tree), matchedIds };
}

export function useOrgChart(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-org-chart", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("hr_employees")
        .select("*")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .neq("status", "terminated")
        .order("full_name", { ascending: true });

      if (error) throw error;
      return buildTree((data as Employee[]) ?? []);
    },
    enabled: !!sectorId,
  });
}

export function useDepartments(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-departments", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("hr_employees")
        .select("department")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .neq("status", "terminated")
        .not("department", "is", null);

      if (error) throw error;

      const depts = new Set<string>();
      ((data ?? []) as { department: string | null }[]).forEach((d) => {
        if (d.department) depts.add(d.department);
      });
      return Array.from(depts).sort();
    },
    enabled: !!sectorId,
  });
}
