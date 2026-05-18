"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createEmailCampaign,
  updateEmailCampaign,
  deleteEmailCampaign,
  sendEmailCampaign,
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

export function useEmailCampaigns(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["marketing-email-campaigns", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("marketing_email_campaigns")
        .select(
          `id, sector_id, campaign_id, segment_id, name, subject, from_name,
           from_email, reply_to, body_html, body_text, status, scheduled_at,
           sent_at, recipient_count, delivered_count, failed_count, created_at`
        )
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as EmailCampaign[];
    },
    enabled: !!sectorId,
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
