"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

export interface JobOpening {
  id: string;
  sector_id: string;
  title: string;
  department: string | null;
  description: string | null;
  requirements: string | null;
  employment_type: string;
  location: string | null;
  salary_range: string | null;
  hiring_manager_id: string | null;
  max_candidates: number | null;
  status: string;
  created_by: string;
  closed_at: string | null;
  created_at: string;
  candidates_count: number;
}

export function useJobOpenings(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-job-openings", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];

      let query = supabase
        .from("hr_job_openings")
        .select(
          `
          *,
          hr_candidates (id)
        `
        )
        .order("created_at", { ascending: false });

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query;

      if (error) throw error;

      return (
        data?.map((opening) => ({
          ...opening,
          candidates_count: Array.isArray(opening.hr_candidates)
            ? opening.hr_candidates.length
            : 0,
          hr_candidates: undefined,
        })) ?? []
      ) as JobOpening[];
    },
    enabled: isScopeReady(scope),
  });
}
