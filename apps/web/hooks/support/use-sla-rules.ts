"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";
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
  // Wave 5 — business-hours schedule + breach escalation action.
  business_timezone: string;
  business_start_minute: number;
  business_end_minute: number;
  business_days_mask: number;
  breach_action: "none" | "notify" | "escalate";
  warn_threshold_pct: number;
}

export function useSLARules(scope: SectorScope | undefined) {
  return useQuery({
    queryKey: ["sla-rules", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];
      const supabase = createClient();
      let query = supabase
        .from("sla_rules")
        .select("*")
        .order("priority", { ascending: true });

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data } = await query;
      return (data || []) as SlaRule[];
    },
    enabled: isScopeReady(scope),
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
