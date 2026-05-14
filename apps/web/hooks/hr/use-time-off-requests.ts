"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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

export function useTimeOffRequests(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-time-off-requests", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("hr_time_off_requests")
        .select(
          `
          *,
          hr_employees!inner (
            full_name, position, department
          )
        `
        )
        .eq("sector_id", sectorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as TimeOffRequest[]) ?? [];
    },
    enabled: !!sectorId,
  });
}
