"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

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
 *
 * The RPC is single-sector by contract (`p_sector_id`), so under the
 * all-sectors scope this hook resolves to the empty metric set.
 */
export function useHeadcountAnalytics(
  scope: SectorScope | undefined,
  windowMonths = 12
) {
  const sectorId = scope ? sectorFilterValue(scope) : undefined;

  return useQuery<HeadcountAnalytics>({
    queryKey: ["hr-headcount-analytics", scope, windowMonths],
    queryFn: async () => {
      if (!sectorId) return { ...EMPTY, window_months: windowMonths };

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
    enabled: isScopeReady(scope),
    staleTime: 60 * 1000,
  });
}
