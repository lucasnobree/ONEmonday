"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

export interface Employee {
  id: string;
  sector_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  position: string;
  department: string | null;
  hire_date: string;
  birth_date: string | null;
  manager_id: string | null;
  employment_type: string;
  status: string;
  termination_date: string | null;
  created_at: string;
}

export function useEmployees(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-employees", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];

      let query = supabase.from("hr_employees").select("*");

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query.order("full_name", {
        ascending: true,
      });

      if (error) throw error;
      return (data as Employee[]) ?? [];
    },
    enabled: isScopeReady(scope),
  });
}
