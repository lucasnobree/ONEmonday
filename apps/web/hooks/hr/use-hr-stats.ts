"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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

export function useHRStats(sectorId: string | undefined) {
  return useQuery<HRStats>({
    queryKey: ["hr-stats", sectorId],
    queryFn: async () => {
      if (!sectorId) return EMPTY_STATS;

      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];

      const [employeesRes, onLeaveRes, pendingRes, positionsRes] =
        await Promise.all([
          // Total active employees
          supabase
            .from("hr_employees")
            .select("id", { count: "exact", head: true })
            .eq("sector_id", sectorId)
            .eq("status", "active")
            .eq("is_active", true),

          // On leave: approved time-off that covers today
          supabase
            .from("hr_time_off_requests")
            .select("id", { count: "exact", head: true })
            .eq("sector_id", sectorId)
            .eq("status", "approved")
            .lte("start_date", today)
            .gte("end_date", today),

          // Pending time-off requests
          supabase
            .from("hr_time_off_requests")
            .select("id", { count: "exact", head: true })
            .eq("sector_id", sectorId)
            .eq("status", "pending"),

          // Open job positions
          supabase
            .from("hr_job_openings")
            .select("id", { count: "exact", head: true })
            .eq("sector_id", sectorId)
            .eq("status", "open")
            .eq("is_active", true),
        ]);

      return {
        totalEmployees: employeesRes.count ?? 0,
        onLeave: onLeaveRes.count ?? 0,
        pendingRequests: pendingRes.count ?? 0,
        openPositions: positionsRes.count ?? 0,
      };
    },
    enabled: !!sectorId,
    staleTime: 60 * 1000,
  });
}
