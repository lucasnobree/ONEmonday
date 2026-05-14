"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createProposal,
  updateProposal,
  updateProposalStatus,
  deleteProposal,
} from "@/lib/actions/crm/proposals";

export interface Proposal {
  id: string;
  deal_id: string;
  sector_id: string;
  title: string;
  content: string | null;
  value: number;
  status: string;
  sent_at: string | null;
  expires_at: string | null;
  created_by: string;
  is_active: boolean;
  created_at: string;
  deal_title: string | null;
}

export interface ProposalItem {
  id: string;
  proposal_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  position: number;
}

export interface ProposalDetail extends Proposal {
  items: ProposalItem[];
}

export function useProposals(
  sectorId: string | undefined,
  statusFilter?: string
) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["crm-proposals", sectorId, statusFilter],
    queryFn: async () => {
      if (!sectorId) return [];

      let query = supabase
        .from("crm_proposals")
        .select(
          `
          id, deal_id, sector_id, title, content, value, status,
          sent_at, expires_at, created_by, is_active, created_at,
          crm_deals (id, card_id, cards (title))
        `
        )
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((p: any) => ({
        id: p.id,
        deal_id: p.deal_id,
        sector_id: p.sector_id,
        title: p.title,
        content: p.content,
        value: p.value,
        status: p.status,
        sent_at: p.sent_at,
        expires_at: p.expires_at,
        created_by: p.created_by,
        is_active: p.is_active,
        created_at: p.created_at,
        deal_title: p.crm_deals?.cards?.title ?? null,
      })) as Proposal[];
    },
    enabled: !!sectorId,
  });
}

export function useDealProposals(dealId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["crm-deal-proposals", dealId],
    queryFn: async () => {
      if (!dealId) return [];

      const { data, error } = await supabase
        .from("crm_proposals")
        .select(
          `
          id, deal_id, sector_id, title, content, value, status,
          sent_at, expires_at, created_by, is_active, created_at
        `
        )
        .eq("deal_id", dealId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Omit<Proposal, "deal_title">[];
    },
    enabled: !!dealId,
  });
}

export function useProposalDetail(proposalId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["crm-proposal-detail", proposalId],
    queryFn: async () => {
      if (!proposalId) return null;

      const { data: proposal, error } = await supabase
        .from("crm_proposals")
        .select(
          `
          id, deal_id, sector_id, title, content, value, status,
          sent_at, expires_at, created_by, is_active, created_at,
          crm_deals (id, card_id, cards (title))
        `
        )
        .eq("id", proposalId)
        .single();

      if (error) throw error;

      const { data: items } = await supabase
        .from("crm_proposal_items")
        .select("id, proposal_id, description, quantity, unit_price, position")
        .eq("proposal_id", proposalId)
        .order("position", { ascending: true });

      const p = proposal as any;
      return {
        id: p.id,
        deal_id: p.deal_id,
        sector_id: p.sector_id,
        title: p.title,
        content: p.content,
        value: p.value,
        status: p.status,
        sent_at: p.sent_at,
        expires_at: p.expires_at,
        created_by: p.created_by,
        is_active: p.is_active,
        created_at: p.created_at,
        deal_title: p.crm_deals?.cards?.title ?? null,
        items: (items || []) as ProposalItem[],
      } as ProposalDetail;
    },
    enabled: !!proposalId,
  });
}

export function useCreateProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: unknown) => createProposal(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["crm-deal-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["crm-deal-detail"] });
    },
  });
}

export function useUpdateProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: unknown) => updateProposal(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["crm-proposal-detail"] });
      queryClient.invalidateQueries({ queryKey: ["crm-deal-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["crm-deal-detail"] });
    },
  });
}

export function useUpdateProposalStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateProposalStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["crm-proposal-detail"] });
      queryClient.invalidateQueries({ queryKey: ["crm-deal-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["crm-deal-detail"] });
    },
  });
}

export function useDeleteProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (proposalId: string) => deleteProposal(proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["crm-deal-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["crm-deal-detail"] });
    },
  });
}
