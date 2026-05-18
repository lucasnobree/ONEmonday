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

interface SlaStatusRow {
  ticket_id: string;
  remaining_pct: number;
}

export function useSupportStats(sectorId: string | undefined) {
  return useQuery<SupportStats>({
    queryKey: ["support-stats", sectorId],
    queryFn: async () => {
      if (!sectorId) return EMPTY_STATS;

      const supabase = createClient();

      const [totalRes, openRes, resolvedRes, slaRes] = await Promise.all([
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

        // Resolved tickets: resolved_at is not null
        supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .eq("sector_id", sectorId)
          .not("resolved_at", "is", null),

        // SLA breached: derived from the same check_sla_status RPC that
        // powers the SLA alert banner, so the KPI card and the banner
        // count exactly the same set of currently-breaching tickets
        // (one active SLA per ticket — response *or* resolution — and
        // paused/resolved tickets excluded by the RPC).
        supabase.rpc("check_sla_status"),
      ]);

      const slaRows = (slaRes.error ? [] : (slaRes.data ?? [])) as SlaStatusRow[];
      const slaBreached = slaRows.filter((r) => r.remaining_pct <= 0).length;

      return {
        totalTickets: totalRes.count ?? 0,
        openTickets: openRes.count ?? 0,
        slaBreached,
        resolvedTickets: resolvedRes.count ?? 0,
      };
    },
    enabled: !!sectorId,
    staleTime: 60 * 1000,
  });
}
