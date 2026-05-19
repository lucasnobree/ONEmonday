"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { isScopeReady, rpcSectorParam } from "@/lib/navigation/scoped-query";
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
 * Headcount & turnover metrics for the trailing `windowMonths`, backed by the
 * get_hr_headcount_analytics RPC (migration 00149).
 *
 * The RPC accepts a nullable `p_sector_id`: under the all-sectors scope this
 * hook passes `null` and the RPC returns a cross-sector aggregate (admin-only,
 * enforced server-side).
 */
export function useHeadcountAnalytics(
  scope: SectorScope | undefined,
  windowMonths = 12
) {
  const sectorParam = rpcSectorParam(scope);

  return useQuery<HeadcountAnalytics>({
    queryKey: ["hr-headcount-analytics", scope, windowMonths],
    queryFn: async () => {
      if (sectorParam === undefined) {
        return { ...EMPTY, window_months: windowMonths };
      }

      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "get_hr_headcount_analytics",
        {
          p_sector_id: sectorParam,
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
