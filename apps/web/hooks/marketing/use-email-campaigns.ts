"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";
import {
  createEmailCampaign,
  updateEmailCampaign,
  deleteEmailCampaign,
  sendEmailCampaign,
  sendEmailCampaignTest,
} from "@/lib/actions/marketing/email-campaigns";
import type { EmailCampaignStatus } from "@/lib/validations/marketing";

export interface EmailCampaign {
  id: string;
  sector_id: string;
  campaign_id: string | null;
  segment_id: string | null;
  name: string;
  subject: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  body_html: string;
  body_text: string;
  status: EmailCampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number;
  delivered_count: number;
  failed_count: number;
  created_at: string;
}

export function useEmailCampaigns(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["marketing-email-campaigns", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];

      let query = supabase
        .from("marketing_email_campaigns")
        .select(
          `id, sector_id, campaign_id, segment_id, name, subject, from_name,
           from_email, reply_to, body_html, body_text, status, scheduled_at,
           sent_at, recipient_count, delivered_count, failed_count, created_at`
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []) as EmailCampaign[];
    },
    enabled: isScopeReady(scope),
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["marketing-email-campaigns"] });
}

export function useCreateEmailCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => createEmailCampaign(input),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useUpdateEmailCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => updateEmailCampaign(input),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteEmailCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEmailCampaign(id),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useSendEmailCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => sendEmailCampaign(input),
    onSuccess: () => invalidate(queryClient),
  });
}

/**
 * Sends a single preview ("test") email of a campaign. Does not invalidate
 * the campaign list — a test send never mutates the campaign's status.
 */
export function useSendEmailCampaignTest() {
  return useMutation({
    mutationFn: (input: unknown) => sendEmailCampaignTest(input),
  });
}
