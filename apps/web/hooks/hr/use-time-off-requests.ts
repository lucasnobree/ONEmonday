"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

export interface TimeOffRequest {
  id: string;
  employee_id: string;
  sector_id: string;
  policy_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  requested_by: string;
  created_at: string;
  hr_employees: {
    full_name: string;
    position: string;
    department: string | null;
  };
}

export function useTimeOffRequests(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-time-off-requests", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];

      let query = supabase.from("hr_time_off_requests").select(
        `
          *,
          hr_employees!inner (
            full_name, position, department
          )
        `
      );

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;
      return (data as TimeOffRequest[]) ?? [];
    },
    enabled: isScopeReady(scope),
  });
}
