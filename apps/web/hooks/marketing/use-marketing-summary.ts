"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";
import type { MarketingChannel } from "@/lib/validations/marketing";

export interface ChannelBreakdown {
  channel: MarketingChannel;
  spend_cents: number;
  leads: number;
  conversions: number;
}

export interface MarketingSummary {
  active_campaigns: number;
  total_campaigns: number;
  total_budget_cents: number;
  total_spend_cents: number;
  total_leads: number;
  total_conversions: number;
  total_impressions: number;
  by_channel: ChannelBreakdown[];
}

/**
 * Marketing KPI totals and the per-channel breakdown, computed server-side
 * by the `get_marketing_summary` RPC (which enforces sector access).
 *
 * The RPC is single-sector by contract (`p_sector_id`), so under the
 * all-sectors scope this hook resolves to `null`.
 */
export function useMarketingSummary(scope: SectorScope | undefined) {
  const supabase = createClient();
  const sectorId = scope ? sectorFilterValue(scope) : undefined;

  return useQuery({
    queryKey: ["marketing-summary", scope],
    queryFn: async (): Promise<MarketingSummary | null> => {
      if (!sectorId) return null;

      const { data, error } = await supabase.rpc("get_marketing_summary", {
        p_sector_id: sectorId,
      });

      if (error) throw error;
      return data as MarketingSummary;
    },
    enabled: isScopeReady(scope),
  });
}
