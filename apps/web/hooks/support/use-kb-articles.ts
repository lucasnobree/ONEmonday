"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createKBArticle,
  updateKBArticle,
  deleteKBArticle,
  toggleKBArticlePublished,
} from "@/lib/actions/support/kb-articles";

export type PublishedFilter = "all" | "published" | "draft";

export interface KBArticle {
  id: string;
  sector_id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  author_id: string;
  is_published: boolean;
  view_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useKBArticles(
  sectorId: string | undefined,
  publishedFilter: PublishedFilter = "all"
) {
  return useQuery<KBArticle[]>({
    queryKey: ["kb-articles", sectorId, publishedFilter],
    queryFn: async () => {
      if (!sectorId) return [];
      const supabase = createClient();
      let query = supabase
        .from("kb_articles")
        .select("*")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (publishedFilter === "published") {
        query = query.eq("is_published", true);
      } else if (publishedFilter === "draft") {
        query = query.eq("is_published", false);
      }

      const { data } = await query;
      return (data || []) as KBArticle[];
    },
    enabled: !!sectorId,
  });
}

export function useCreateKBArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: unknown) => createKBArticle(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-articles"] });
    },
  });
}

export function useUpdateKBArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      updateKBArticle(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-articles"] });
    },
  });
}

export function useDeleteKBArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteKBArticle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-articles"] });
    },
  });
}

export function useToggleKBArticlePublished() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => toggleKBArticlePublished(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-articles"] });
    },
  });
}
