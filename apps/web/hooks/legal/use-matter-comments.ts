"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createMatterComment,
  updateMatterComment,
  deleteMatterComment,
} from "@/lib/actions/legal/matter-comments";

/** A single comment in a matter's thread. */
export interface MatterComment {
  id: string;
  matter_id: string;
  sector_id: string;
  body: string;
  author_id: string;
  created_at: string;
  updated_at: string;
}

/** The comment thread of a matter, oldest first (conversation order). */
export function useMatterComments(matterId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["legal-matter-comments", matterId],
    queryFn: async () => {
      if (!matterId) return [];
      const { data, error } = await supabase
        .from("legal_matter_comments")
        .select("*")
        .eq("matter_id", matterId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as MatterComment[]) ?? [];
    },
    enabled: !!matterId,
  });
}

export function useCreateMatterComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => createMatterComment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-matter-comments"] });
    },
  });
}

export function useUpdateMatterComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => updateMatterComment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-matter-comments"] });
    },
  });
}

export function useDeleteMatterComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteMatterComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-matter-comments"] });
    },
  });
}
