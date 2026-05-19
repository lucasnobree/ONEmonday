"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";
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

export function useContentItems(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["marketing-content", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];

      let query = supabase
        .from("marketing_content_items")
        .select(
          `id, sector_id, campaign_id, title, notes, channel, status,
           scheduled_date, created_at`
        )
        .eq("is_active", true)
        .order("scheduled_date", { ascending: true });

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []) as ContentItem[];
    },
    enabled: isScopeReady(scope),
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
