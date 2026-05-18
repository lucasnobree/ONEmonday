"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  mapMetricsRow,
  EMPTY_METRICS,
  type SupportOperationalMetrics,
} from "@/lib/support/metrics";

/**
 * Operational dashboard KPIs (Wave 4 H1) — first-response time, resolution
 * time, SLA attainment % and backlog age for the current sector. Driven by
 * the `get_support_operational_metrics` RPC (migration 00197).
 */
export function useSupportMetrics(sectorId: string | undefined) {
  return useQuery<SupportOperationalMetrics>({
    queryKey: ["support-metrics", sectorId],
    queryFn: async () => {
      if (!sectorId) return EMPTY_METRICS;
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "get_support_operational_metrics",
        { p_sector_id: sectorId }
      );
      if (error) return EMPTY_METRICS;
      // The RPC returns a single-row table.
      const row = Array.isArray(data) ? data[0] : data;
      return mapMetricsRow(row as Record<string, unknown> | null);
    },
    enabled: !!sectorId,
    staleTime: 60 * 1000,
  });
}
