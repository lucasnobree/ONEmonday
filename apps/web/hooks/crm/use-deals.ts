"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";
import {
  createDeal,
  closeDealWon,
  closeDealLost,
  assignDealOwner,
} from "@/lib/actions/crm/deals";

export interface Deal {
  id: string;
  card_id: string;
  sector_id: string;
  company_id: string | null;
  contact_id: string | null;
  owner_id: string | null;
  value: number | null;
  currency: string;
  expected_close_date: string | null;
  actual_close_date: string | null;
  win_probability: number | null;
  lost_reason: string | null;
  last_stage_change_at: string | null;
  source: string | null;
  created_at: string;
  owner: { id: string; full_name: string } | null;
  card: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    column_id: string;
    board_id: string;
    is_active: boolean;
    created_by: string | null;
    board_columns: {
      id: string;
      name: string;
      color: string;
      position: number;
      is_done_column: boolean;
    };
    users: { id: string; full_name: string } | null;
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

export function useDeals(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["crm-deals", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];

      let query = supabase
        .from("crm_deals")
        .select(
          `
          id, card_id, sector_id, company_id, contact_id, owner_id,
          value, currency, expected_close_date, actual_close_date,
          win_probability, lost_reason, last_stage_change_at, source, created_at,
          cards!inner (
            id, title, description, priority, column_id, board_id, is_active,
            created_by,
            board_columns!inner (id, name, color, position, is_done_column),
            users (id, full_name)
          ),
          crm_companies (id, name),
          crm_contacts (id, full_name),
          owner:users!crm_deals_owner_id_fkey (id, full_name)
        `
        )
        .eq("cards.is_active", true);

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;

      return ((data ?? []) as Record<string, unknown>[]).map((d) => ({
        ...d,
        card: d.cards,
        company: d.crm_companies,
        contact: d.crm_contacts,
        owner: d.owner,
      })) as unknown as Deal[];
    },
    enabled: isScopeReady(scope),
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
    mutationFn: (input: {
      dealId: string;
      category: string;
      reason: string;
    }) => closeDealLost(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-deals"] });
      queryClient.invalidateQueries({ queryKey: ["crm-stats"] });
    },
  });
}

export function useAssignDealOwner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dealId: string; ownerId: string | null }) =>
      assignDealOwner(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-deals"] });
      queryClient.invalidateQueries({ queryKey: ["crm-deal-detail"] });
    },
  });
}
