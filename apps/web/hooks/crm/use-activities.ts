"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createActivity } from "@/lib/actions/crm/activities";

export interface Activity {
  id: string;
  sector_id: string;
  deal_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  type: "call" | "email" | "meeting" | "note" | "task";
  subject: string;
  description: string | null;
  scheduled_at: string | null;
  duration_min: number | null;
  performed_by: string;
  created_at: string;
  deal: { id: string; card_id: string; cards: { title: string } } | null;
  contact: { id: string; full_name: string } | null;
  company: { id: string; name: string } | null;
  user: { full_name: string } | null;
}

interface UseActivitiesOptions {
  sectorId: string | undefined;
  dealId?: string;
  contactId?: string;
  companyId?: string;
}

export function useActivities({
  sectorId,
  dealId,
  contactId,
  companyId,
}: UseActivitiesOptions) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["crm-activities", sectorId, dealId, contactId, companyId],
    queryFn: async () => {
      if (!sectorId) return [];

      let query = supabase
        .from("crm_activities")
        .select(
          `
          id, sector_id, deal_id, contact_id, company_id,
          type, subject, description, scheduled_at, duration_min,
          performed_by, created_at,
          crm_deals (id, card_id, cards (title)),
          crm_contacts (id, full_name),
          crm_companies (id, name),
          users!crm_activities_performed_by_fkey (full_name)
        `
        )
        .eq("sector_id", sectorId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (dealId) query = query.eq("deal_id", dealId);
      if (contactId) query = query.eq("contact_id", contactId);
      if (companyId) query = query.eq("company_id", companyId);

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((a: any) => ({
        ...a,
        deal: a.crm_deals,
        contact: a.crm_contacts,
        company: a.crm_companies,
        user: a.users,
      })) as Activity[];
    },
    enabled: !!sectorId,
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: unknown) => createActivity(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-activities"] });
    },
  });
}
