"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

/**
 * Cross-module KPI snapshot for a sector over a rolling window, computed
 * server-side by the `get_analytics_overview` RPC (which enforces sector
 * access). Each metric carries a "current" and "previous" value so the UI can
 * render a period-over-period delta.
 */
export interface AnalyticsOverview {
  range_days: number;
  cards_completed_current: number;
  cards_completed_previous: number;
  cards_open: number;
  deals_won_value_cents_current: number;
  deals_won_value_cents_previous: number;
  deals_open: number;
  tickets_resolved_current: number;
  tickets_resolved_previous: number;
  tickets_open: number;
  sla_breaches_current: number;
  headcount_active: number;
}

/**
 * The `get_analytics_overview` RPC is single-sector by contract
 * (`p_sector_id`), so under the all-sectors scope this hook resolves to
 * `null`.
 */
export function useAnalyticsOverview(
  scope: SectorScope | undefined,
  rangeDays: number
) {
  const supabase = createClient();
  const sectorId = scope ? sectorFilterValue(scope) : undefined;

  return useQuery({
    queryKey: ["analytics-overview", scope, rangeDays],
    queryFn: async (): Promise<AnalyticsOverview | null> => {
      if (!sectorId) return null;

      const { data, error } = await supabase.rpc("get_analytics_overview", {
        p_sector_id: sectorId,
        p_range_days: rangeDays,
      });

      if (error) throw error;
      return data as AnalyticsOverview;
    },
    enabled: isScopeReady(scope),
    staleTime: 60 * 1000,
  });
}
