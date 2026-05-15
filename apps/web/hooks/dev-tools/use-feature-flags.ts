"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createFeatureFlag,
  updateFeatureFlag,
  toggleFeatureFlag,
  deleteFeatureFlag,
} from "@/lib/actions/dev-tools/feature-flags";

export interface DevFeatureFlag {
  id: string;
  sector_id: string;
  service_id: string | null;
  key: string;
  description: string | null;
  environment: string;
  is_enabled: boolean;
  rollout_percentage: number;
  owner_id: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useFeatureFlags(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dev-feature-flags", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("dev_feature_flags")
        .select("*")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("key", { ascending: true });

      if (error) throw error;
      return (data as DevFeatureFlag[]) ?? [];
    },
    enabled: !!sectorId,
  });
}

function useFlagInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["dev-feature-flags"] });
    queryClient.invalidateQueries({ queryKey: ["dev-tools-stats"] });
  };
}

export function useCreateFeatureFlag() {
  const invalidate = useFlagInvalidation();
  return useMutation({
    mutationFn: (input: unknown) => createFeatureFlag(input),
    onSuccess: invalidate,
  });
}

export function useUpdateFeatureFlag() {
  const invalidate = useFlagInvalidation();
  return useMutation({
    mutationFn: (input: unknown) => updateFeatureFlag(input),
    onSuccess: invalidate,
  });
}

export function useToggleFeatureFlag() {
  const invalidate = useFlagInvalidation();
  return useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      toggleFeatureFlag(id, isEnabled),
    onSuccess: invalidate,
  });
}

export function useDeleteFeatureFlag() {
  const invalidate = useFlagInvalidation();
  return useMutation({
    mutationFn: (id: string) => deleteFeatureFlag(id),
    onSuccess: invalidate,
  });
}
