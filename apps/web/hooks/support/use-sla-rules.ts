"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createSlaRule,
  updateSlaRule,
  deleteSlaRule,
  toggleSlaRule,
} from "@/lib/actions/support/sla-rules";

export interface SlaRule {
  id: string;
  sector_id: string;
  name: string;
  priority: string;
  category: string | null;
  response_time_hours: number;
  resolve_time_hours: number;
  business_hours_only: boolean;
  is_active: boolean;
  created_at: string;
}

export function useSLARules(sectorId: string | undefined) {
  return useQuery({
    queryKey: ["sla-rules", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("sla_rules")
        .select("*")
        .eq("sector_id", sectorId)
        .order("priority", { ascending: true });
      return (data || []) as SlaRule[];
    },
    enabled: !!sectorId,
  });
}

export function useCreateSlaRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: unknown) => createSlaRule(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-rules"] });
    },
  });
}

export function useUpdateSlaRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      updateSlaRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-rules"] });
    },
  });
}

export function useDeleteSlaRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSlaRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-rules"] });
    },
  });
}

export function useToggleSlaRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleSlaRule(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-rules"] });
    },
  });
}
