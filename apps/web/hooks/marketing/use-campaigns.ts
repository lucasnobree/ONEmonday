"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from "@/lib/actions/marketing/campaigns";
import type {
  MarketingChannel,
  CampaignStatus,
} from "@/lib/validations/marketing";

export interface Campaign {
  id: string;
  sector_id: string;
  name: string;
  description: string | null;
  channel: MarketingChannel;
  status: CampaignStatus;
  budget_cents: number;
  spend_cents: number;
  currency: string;
  impressions: number;
  leads: number;
  conversions: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export function useCampaigns(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["marketing-campaigns", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("marketing_campaigns")
        .select(
          `id, sector_id, name, description, channel, status, budget_cents,
           spend_cents, currency, impressions, leads, conversions,
           start_date, end_date, created_at`
        )
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("start_date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
    enabled: !!sectorId,
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] });
  queryClient.invalidateQueries({ queryKey: ["marketing-summary"] });
  queryClient.invalidateQueries({ queryKey: ["marketing-content"] });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => createCampaign(input),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => updateCampaign(input),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) => deleteCampaign(campaignId),
    onSuccess: () => invalidate(queryClient),
  });
}
