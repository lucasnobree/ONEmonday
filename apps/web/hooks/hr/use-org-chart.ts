"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Employee } from "@/hooks/hr/use-employees";

export interface OrgNode {
  employee: Employee;
  children: OrgNode[];
}

function buildTree(employees: Employee[]): OrgNode[] {
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

export function useOrgChart(
  sectorId: string | undefined,
  departmentFilter?: string
) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-org-chart", sectorId, departmentFilter],
    queryFn: async () => {
      if (!sectorId) return [];

      let query = supabase
        .from("hr_employees")
        .select("*")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .neq("status", "terminated")
        .order("full_name", { ascending: true });

      if (departmentFilter) {
        query = query.eq("department", departmentFilter);
      }

      const { data, error } = await query;

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
      (data ?? []).forEach((d: any) => {
        if (d.department) depts.add(d.department);
      });
      return Array.from(depts).sort();
    },
    enabled: !!sectorId,
  });
}
