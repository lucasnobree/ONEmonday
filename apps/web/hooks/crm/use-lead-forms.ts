"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";
import {
  createLeadForm,
  updateLeadForm,
  setLeadFormPublished,
  deleteLeadForm,
} from "@/lib/actions/crm/lead-forms";
import type { LeadFormField } from "@/lib/validations/crm";

/** A lead-capture form, with a count of the leads it has captured. */
export interface LeadForm {
  id: string;
  sector_id: string;
  name: string;
  description: string | null;
  public_token: string;
  fields: LeadFormField[];
  source: string;
  success_message: string;
  is_published: boolean;
  created_at: string;
  lead_count: number;
}

export function useLeadForms(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["crm-lead-forms", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];

      let query = supabase
        .from("crm_lead_forms")
        .select(
          `
          id, sector_id, name, description, public_token, fields, source,
          success_message, is_published, created_at,
          crm_leads (count)
        `
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query;

      if (error) throw error;

      return ((data ?? []) as Record<string, unknown>[]).map((f) => {
        const counts = f.crm_leads as { count: number }[] | null;
        return {
          ...f,
          lead_count: counts?.[0]?.count ?? 0,
          crm_leads: undefined,
        };
      }) as unknown as LeadForm[];
    },
    enabled: isScopeReady(scope),
  });
}

function formKeys(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["crm-lead-forms"] });
}

export function useCreateLeadForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => createLeadForm(input),
    onSuccess: () => formKeys(queryClient),
  });
}

export function useUpdateLeadForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => updateLeadForm(input),
    onSuccess: () => formKeys(queryClient),
  });
}

export function useSetLeadFormPublished() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; published: boolean }) =>
      setLeadFormPublished(input),
    onSuccess: () => formKeys(queryClient),
  });
}

export function useDeleteLeadForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formId: string) => deleteLeadForm(formId),
    onSuccess: () => formKeys(queryClient),
  });
}
