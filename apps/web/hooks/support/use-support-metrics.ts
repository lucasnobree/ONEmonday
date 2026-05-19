"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { isScopeReady, rpcSectorParam } from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";
import {
  mapMetricsRow,
  EMPTY_METRICS,
  type SupportOperationalMetrics,
} from "@/lib/support/metrics";

/**
 * Operational dashboard KPIs (Wave 4 H1) — first-response time, resolution
 * time, SLA attainment % and backlog age. Driven by the
 * `get_support_operational_metrics` RPC (migration 00197).
 *
 * The RPC accepts a nullable `p_sector_id`: under the all-sectors scope this
 * hook passes `null` and the RPC returns a cross-sector aggregate (admin-only,
 * enforced server-side).
 */
export function useSupportMetrics(scope: SectorScope | undefined) {
  const sectorParam = rpcSectorParam(scope);

  return useQuery<SupportOperationalMetrics>({
    queryKey: ["support-metrics", scope],
    queryFn: async () => {
      if (sectorParam === undefined) return EMPTY_METRICS;
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "get_support_operational_metrics",
        { p_sector_id: sectorParam }
      );
      if (error) return EMPTY_METRICS;
      // The RPC returns a single-row table.
      const row = Array.isArray(data) ? data[0] : data;
      return mapMetricsRow(row as Record<string, unknown> | null);
    },
    enabled: isScopeReady(scope),
    staleTime: 60 * 1000,
  });
}
