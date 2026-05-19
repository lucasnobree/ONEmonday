"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";
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

export function useCannedResponses(scope: SectorScope | undefined) {
  return useQuery<CannedResponse[]>({
    queryKey: ["canned-responses", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];
      const supabase = createClient();
      let query = supabase
        .from("canned_responses")
        .select("*")
        .eq("is_active", true)
        .order("title", { ascending: true });

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data } = await query;
      return (data || []) as CannedResponse[];
    },
    enabled: isScopeReady(scope),
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
