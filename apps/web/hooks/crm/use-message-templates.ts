"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
} from "@/lib/actions/crm/message-templates";
import type { MessageTemplateChannel } from "@/lib/validations/crm";

/** A reusable WhatsApp / email message template (migration 00185). */
export interface MessageTemplate {
  id: string;
  sector_id: string;
  channel: MessageTemplateChannel;
  name: string;
  /** Non-null only for email templates. */
  subject: string | null;
  body: string;
  created_at: string;
}

/**
 * The sector's active message templates, ordered by name. The deal
 * Communication panel filters this to the composer's channel.
 */
export function useMessageTemplates(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["crm-message-templates", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];
      const { data, error } = await supabase
        .from("crm_message_templates")
        .select("id, sector_id, channel, name, subject, body, created_at")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return (data ?? []) as MessageTemplate[];
    },
    enabled: !!sectorId,
  });
}

function templateKeys(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["crm-message-templates"] });
}

export function useCreateMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => createMessageTemplate(input),
    onSuccess: () => templateKeys(queryClient),
  });
}

export function useUpdateMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; values: unknown }) =>
      updateMessageTemplate(input.id, input.values),
    onSuccess: () => templateKeys(queryClient),
  });
}

export function useDeleteMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMessageTemplate(id),
    onSuccess: () => templateKeys(queryClient),
  });
}
