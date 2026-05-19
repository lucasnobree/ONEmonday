"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";
import {
  createSegment,
  updateSegment,
  deleteSegment,
} from "@/lib/actions/marketing/segments";
import type { MarketingChannel } from "@/lib/validations/marketing";

export interface AudienceSegment {
  id: string;
  sector_id: string;
  name: string;
  description: string | null;
  channel: MarketingChannel;
  estimated_size: number;
  created_at: string;
}

export function useSegments(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["marketing-segments", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];

      let query = supabase
        .from("marketing_audience_segments")
        .select(
          `id, sector_id, name, description, channel, estimated_size, created_at`
        )
        .eq("is_active", true)
        .order("name", { ascending: true });

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []) as AudienceSegment[];
    },
    enabled: isScopeReady(scope),
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["marketing-segments"] });
}

export function useCreateSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => createSegment(input),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useUpdateSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => updateSegment(input),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (segmentId: string) => deleteSegment(segmentId),
    onSuccess: () => invalidate(queryClient),
  });
}
