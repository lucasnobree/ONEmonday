"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

export interface HRStats {
  totalEmployees: number;
  onLeave: number;
  pendingRequests: number;
  openPositions: number;
}

const EMPTY_STATS: HRStats = {
  totalEmployees: 0,
  onLeave: 0,
  pendingRequests: 0,
  openPositions: 0,
};

export function useHRStats(scope: SectorScope | undefined) {
  return useQuery<HRStats>({
    queryKey: ["hr-stats", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return EMPTY_STATS;

      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];
      const filterSectorId = sectorFilterValue(scope);

      // Total active employees
      let employeesQuery = supabase
        .from("hr_employees")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .eq("is_active", true);
      if (filterSectorId)
        employeesQuery = employeesQuery.eq("sector_id", filterSectorId);

      // On leave: approved time-off that covers today
      let onLeaveQuery = supabase
        .from("hr_time_off_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today);
      if (filterSectorId)
        onLeaveQuery = onLeaveQuery.eq("sector_id", filterSectorId);

      // Pending time-off requests
      let pendingQuery = supabase
        .from("hr_time_off_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (filterSectorId)
        pendingQuery = pendingQuery.eq("sector_id", filterSectorId);

      // Open job positions
      let positionsQuery = supabase
        .from("hr_job_openings")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .eq("is_active", true);
      if (filterSectorId)
        positionsQuery = positionsQuery.eq("sector_id", filterSectorId);

      const [employeesRes, onLeaveRes, pendingRes, positionsRes] =
        await Promise.all([
          employeesQuery,
          onLeaveQuery,
          pendingQuery,
          positionsQuery,
        ]);

      return {
        totalEmployees: employeesRes.count ?? 0,
        onLeave: onLeaveRes.count ?? 0,
        pendingRequests: pendingRes.count ?? 0,
        openPositions: positionsRes.count ?? 0,
      };
    },
    enabled: isScopeReady(scope),
    staleTime: 60 * 1000,
  });
}
