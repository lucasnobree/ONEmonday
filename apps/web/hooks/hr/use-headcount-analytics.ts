"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface HeadcountAnalytics {
  current_headcount: number;
  hires_in_window: number;
  exits_in_window: number;
  turnover_rate: number;
  net_change: number;
  window_months: number;
}

const EMPTY: HeadcountAnalytics = {
  current_headcount: 0,
  hires_in_window: 0,
  exits_in_window: 0,
  turnover_rate: 0,
  net_change: 0,
  window_months: 12,
};

/**
 * Headcount & turnover metrics for the trailing `windowMonths` of a sector,
 * backed by the get_hr_headcount_analytics RPC (migration 00149).
 */
export function useHeadcountAnalytics(
  sectorId: string | undefined,
  windowMonths = 12
) {
  return useQuery<HeadcountAnalytics>({
    queryKey: ["hr-headcount-analytics", sectorId, windowMonths],
    queryFn: async () => {
      if (!sectorId) return EMPTY;

      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "get_hr_headcount_analytics",
        {
          p_sector_id: sectorId,
          p_window_months: windowMonths,
        }
      );

      if (error) throw error;

      const row = (data as HeadcountAnalytics[] | null)?.[0];
      return row ?? { ...EMPTY, window_months: windowMonths };
    },
    enabled: !!sectorId,
    staleTime: 60 * 1000,
  });
}
