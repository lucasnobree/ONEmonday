"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
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
 */
export function useMarketingSummary(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["marketing-summary", sectorId],
    queryFn: async (): Promise<MarketingSummary | null> => {
      if (!sectorId) return null;

      const { data, error } = await supabase.rpc("get_marketing_summary", {
        p_sector_id: sectorId,
      });

      if (error) throw error;
      return data as MarketingSummary;
    },
    enabled: !!sectorId,
  });
}
