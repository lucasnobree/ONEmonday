"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
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

export function useSegments(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["marketing-segments", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("marketing_audience_segments")
        .select(
          `id, sector_id, name, description, channel, estimated_size, created_at`
        )
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return (data ?? []) as AudienceSegment[];
    },
    enabled: !!sectorId,
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
