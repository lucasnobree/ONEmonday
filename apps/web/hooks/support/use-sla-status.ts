"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface SlaStatusEntry {
  ticket_id: string;
  ticket_title: string;
  priority: string;
  sla_type: string;
  deadline_at: string;
  remaining_pct: number;
}

export function useSlaStatus(enabled = true) {
  return useQuery<SlaStatusEntry[]>({
    queryKey: ["sla-status"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("check_sla_status");
      if (error) return [];
      return (data || []) as SlaStatusEntry[];
    },
    enabled,
    refetchInterval: 60000,
  });
}
