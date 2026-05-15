"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
} from "@/lib/actions/support/canned-responses";

export interface CannedResponse {
  id: string;
  sector_id: string;
  title: string;
  content: string;
  category: string | null;
  shortcut: string | null;
  created_by: string;
  is_active: boolean;
  created_at: string;
}

export function useCannedResponses(sectorId: string | undefined) {
  return useQuery<CannedResponse[]>({
    queryKey: ["canned-responses", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("canned_responses")
        .select("*")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("title", { ascending: true });
      return (data || []) as CannedResponse[];
    },
    enabled: !!sectorId,
  });
}

export function useCreateCannedResponse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => createCannedResponse(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canned-responses"] });
    },
  });
}

export function useUpdateCannedResponse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      updateCannedResponse(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canned-responses"] });
    },
  });
}

export function useDeleteCannedResponse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCannedResponse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canned-responses"] });
    },
  });
}
