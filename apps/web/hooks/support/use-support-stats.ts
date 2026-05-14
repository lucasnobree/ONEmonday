"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface SupportStats {
  totalTickets: number;
  openTickets: number;
  slaBreached: number;
  resolvedTickets: number;
}

const EMPTY_STATS: SupportStats = {
  totalTickets: 0,
  openTickets: 0,
  slaBreached: 0,
  resolvedTickets: 0,
};

export function useSupportStats(sectorId: string | undefined) {
  return useQuery<SupportStats>({
    queryKey: ["support-stats", sectorId],
    queryFn: async () => {
      if (!sectorId) return EMPTY_STATS;

      const supabase = createClient();

      const [totalRes, openRes, slaRes, resolvedRes] = await Promise.all([
        // Total tickets
        supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .eq("sector_id", sectorId),

        // Open tickets: resolved_at is null
        supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .eq("sector_id", sectorId)
          .is("resolved_at", null),

        // SLA breached: sla_response_breached or sla_resolve_breached
        supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .eq("sector_id", sectorId)
          .or("sla_response_breached.eq.true,sla_resolve_breached.eq.true"),

        // Resolved tickets: resolved_at is not null
        supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .eq("sector_id", sectorId)
          .not("resolved_at", "is", null),
      ]);

      return {
        totalTickets: totalRes.count ?? 0,
        openTickets: openRes.count ?? 0,
        slaBreached: slaRes.count ?? 0,
        resolvedTickets: resolvedRes.count ?? 0,
      };
    },
    enabled: !!sectorId,
    staleTime: 60 * 1000,
  });
}
