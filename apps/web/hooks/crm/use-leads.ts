"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createLead,
  updateLead,
  discardLead,
  reopenLead,
  qualifyLead,
} from "@/lib/actions/crm/leads";
import type { LeadStatus } from "@/lib/validations/crm";

/** A raw inbound lead row, with its capture form and owner joined. */
export interface Lead {
  id: string;
  sector_id: string;
  form_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string;
  payload: Record<string, unknown>;
  status: LeadStatus;
  score: number;
  discard_reason: string | null;
  converted_deal_id: string | null;
  converted_contact_id: string | null;
  converted_at: string | null;
  owner_id: string | null;
  created_at: string;
  form: { id: string; name: string } | null;
  owner: { id: string; full_name: string } | null;
}

/** Inbox KPI counts returned by the `get_crm_lead_stats` RPC. */
export interface LeadStats {
  total: number;
  new: number;
  working: number;
  qualified: number;
  discarded: number;
  avg_score: number;
}

/** Lead-aging / SLA counts returned by the `get_crm_lead_aging` RPC. */
export interface LeadAgingStats {
  /** The sector's SLA window in hours; 0 = the aging indicator is off. */
  sla_hours: number;
  /** Untouched ('new') leads, regardless of age. */
  untouched: number;
  /** Untouched leads that have breached the SLA window. */
  overdue: number;
}

export function useLeads(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["crm-leads", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("crm_leads")
        .select(
          `
          id, sector_id, form_id, name, email, phone, company, source,
          payload, status, score, discard_reason, converted_deal_id,
          converted_contact_id, converted_at, owner_id, created_at,
          crm_lead_forms (id, name),
          owner:users!crm_leads_owner_id_fkey (id, full_name)
        `
        )
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("score", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      return ((data ?? []) as Record<string, unknown>[]).map((l) => ({
        ...l,
        form: l.crm_lead_forms,
        owner: l.owner,
        crm_lead_forms: undefined,
      })) as unknown as Lead[];
    },
    enabled: !!sectorId,
  });
}

export function useLeadStats(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["crm-lead-stats", sectorId],
    queryFn: async () => {
      if (!sectorId) return null;
      const { data, error } = await supabase.rpc("get_crm_lead_stats", {
        p_sector_id: sectorId,
      });
      if (error) throw error;
      return data as LeadStats;
    },
    enabled: !!sectorId,
  });
}

/** Inbox SLA-aging counts (the `get_crm_lead_aging` RPC). */
export function useLeadAging(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["crm-lead-aging", sectorId],
    queryFn: async () => {
      if (!sectorId) return null;
      const { data, error } = await supabase.rpc("get_crm_lead_aging", {
        p_sector_id: sectorId,
      });
      if (error) throw error;
      return data as LeadAgingStats;
    },
    enabled: !!sectorId,
  });
}

/** Invalidates every leads query after a mutation. */
function leadKeys(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
  queryClient.invalidateQueries({ queryKey: ["crm-lead-stats"] });
  queryClient.invalidateQueries({ queryKey: ["crm-lead-aging"] });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => createLead(input),
    onSuccess: () => leadKeys(queryClient),
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => updateLead(input),
    onSuccess: () => leadKeys(queryClient),
  });
}

export function useDiscardLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; reason: string }) => discardLead(input),
    onSuccess: () => leadKeys(queryClient),
  });
}

export function useReopenLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => reopenLead(leadId),
    onSuccess: () => leadKeys(queryClient),
  });
}

export function useQualifyLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => qualifyLead(input),
    onSuccess: () => {
      leadKeys(queryClient);
      queryClient.invalidateQueries({ queryKey: ["crm-deals"] });
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
    },
  });
}
