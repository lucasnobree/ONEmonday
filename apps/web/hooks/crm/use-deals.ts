"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createDeal, closeDealWon, closeDealLost } from "@/lib/actions/crm/deals";

export interface Deal {
  id: string;
  card_id: string;
  sector_id: string;
  company_id: string | null;
  contact_id: string | null;
  value: number | null;
  currency: string;
  expected_close_date: string | null;
  actual_close_date: string | null;
  win_probability: number | null;
  lost_reason: string | null;
  source: string | null;
  created_at: string;
  card: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    column_id: string;
    board_id: string;
    is_active: boolean;
    board_columns: {
      id: string;
      name: string;
      color: string;
      is_done_column: boolean;
    };
  };
  company: {
    id: string;
    name: string;
  } | null;
  contact: {
    id: string;
    full_name: string;
  } | null;
}

export function useDeals(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["crm-deals", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("crm_deals")
        .select(
          `
          id, card_id, sector_id, company_id, contact_id,
          value, currency, expected_close_date, actual_close_date,
          win_probability, lost_reason, source, created_at,
          cards!inner (
            id, title, description, priority, column_id, board_id, is_active,
            board_columns!inner (id, name, color, is_done_column)
          ),
          crm_companies (id, name),
          crm_contacts (id, full_name)
        `
        )
        .eq("sector_id", sectorId)
        .eq("cards.is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((d: any) => ({
        ...d,
        card: d.cards,
        company: d.crm_companies,
        contact: d.crm_contacts,
      })) as Deal[];
    },
    enabled: !!sectorId,
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: unknown) => createDeal(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-deals"] });
      queryClient.invalidateQueries({ queryKey: ["crm-stats"] });
    },
  });
}

export function useCloseDealWon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dealId: string) => closeDealWon(dealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-deals"] });
      queryClient.invalidateQueries({ queryKey: ["crm-stats"] });
    },
  });
}

export function useCloseDealLost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ dealId, reason }: { dealId: string; reason: string }) =>
      closeDealLost(dealId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-deals"] });
      queryClient.invalidateQueries({ queryKey: ["crm-stats"] });
    },
  });
}
