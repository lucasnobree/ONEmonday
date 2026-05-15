"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { MetricKey } from "@/lib/analytics/metrics";

/** One monthly data point of a metric trend series. */
export interface TrendPoint {
  bucket: string;
  value: number;
}

/**
 * Monthly time-series for a single metric, computed server-side by the
 * `get_analytics_trend` RPC (which enforces sector access). Used to render
 * saved-report line / bar charts.
 */
export function useAnalyticsTrend(
  sectorId: string | undefined,
  metric: MetricKey | undefined,
  rangeDays: number
) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["analytics-trend", sectorId, metric, rangeDays],
    queryFn: async (): Promise<TrendPoint[]> => {
      if (!sectorId || !metric) return [];

      const { data, error } = await supabase.rpc("get_analytics_trend", {
        p_sector_id: sectorId,
        p_metric: metric,
        p_range_days: rangeDays,
      });

      if (error) throw error;
      return (data ?? []) as TrendPoint[];
    },
    enabled: !!sectorId && !!metric,
    staleTime: 60 * 1000,
  });
}
