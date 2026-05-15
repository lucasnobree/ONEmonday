"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createContentItem,
  updateContentItem,
  deleteContentItem,
} from "@/lib/actions/marketing/content-items";
import type {
  MarketingChannel,
  ContentStatus,
} from "@/lib/validations/marketing";

export interface ContentItem {
  id: string;
  sector_id: string;
  campaign_id: string | null;
  title: string;
  notes: string | null;
  channel: MarketingChannel;
  status: ContentStatus;
  scheduled_date: string;
  created_at: string;
}

export function useContentItems(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["marketing-content", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("marketing_content_items")
        .select(
          `id, sector_id, campaign_id, title, notes, channel, status,
           scheduled_date, created_at`
        )
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("scheduled_date", { ascending: true });

      if (error) throw error;
      return (data ?? []) as ContentItem[];
    },
    enabled: !!sectorId,
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["marketing-content"] });
}

export function useCreateContentItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => createContentItem(input),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useUpdateContentItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => updateContentItem(input),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteContentItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => deleteContentItem(itemId),
    onSuccess: () => invalidate(queryClient),
  });
}
