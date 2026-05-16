"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface TimeOffPolicy {
  id: string;
  sector_id: string;
  name: string;
  days_per_year: number;
  requires_approval: boolean;
  max_consecutive_days: number | null;
  is_active: boolean;
}

export function useTimeOffPolicies(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-time-off-policies", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("hr_time_off_policies")
        .select("*")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return (data as TimeOffPolicy[]) ?? [];
    },
    enabled: !!sectorId,
  });
}
