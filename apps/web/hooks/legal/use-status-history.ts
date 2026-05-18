"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  applyContractApproval,
  changeMatterStatus,
} from "@/lib/actions/legal/status-history";

/** A single status-transition record from `legal_status_history`. */
export interface StatusHistoryEntry {
  id: string;
  entity_type: "contract" | "matter";
  entity_id: string;
  sector_id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  changed_by: string;
  created_at: string;
}

/**
 * The status-change history of a contract or matter, oldest first so the
 * detail-sheet timeline reads top-to-bottom.
 */
export function useStatusHistory(
  entityType: "contract" | "matter",
  entityId: string | undefined
) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["legal-status-history", entityType, entityId],
    queryFn: async () => {
      if (!entityId) return [];
      const { data, error } = await supabase
        .from("legal_status_history")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as StatusHistoryEntry[]) ?? [];
    },
    enabled: !!entityId,
  });
}

/** Runs a lightweight contract-approval action (submit / approve / reject). */
export function useContractApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => applyContractApproval(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["legal-status-history"] });
      queryClient.invalidateQueries({ queryKey: ["legal-stats"] });
    },
  });
}

/** Advances a matter's status directly from the detail sheet. */
export function useChangeMatterStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => changeMatterStatus(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-matters"] });
      queryClient.invalidateQueries({ queryKey: ["legal-status-history"] });
      queryClient.invalidateQueries({ queryKey: ["legal-stats"] });
    },
  });
}
