"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

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

export function useSupportStats(scope: SectorScope | undefined) {
  return useQuery<SupportStats>({
    queryKey: ["support-stats", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return EMPTY_STATS;

      const supabase = createClient();
      const filterSectorId = sectorFilterValue(scope);

      // Total tickets
      let totalQuery = supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true });
      if (filterSectorId)
        totalQuery = totalQuery.eq("sector_id", filterSectorId);

      // Open tickets: resolved_at is null
      let openQuery = supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .is("resolved_at", null);
      if (filterSectorId) openQuery = openQuery.eq("sector_id", filterSectorId);

      // Resolved tickets: resolved_at is not null
      let resolvedQuery = supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .not("resolved_at", "is", null);
      if (filterSectorId)
        resolvedQuery = resolvedQuery.eq("sector_id", filterSectorId);

      const [totalRes, openRes, resolvedRes, slaRes] = await Promise.all([
        totalQuery,
        openQuery,
        resolvedQuery,
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
    enabled: isScopeReady(scope),
    staleTime: 60 * 1000,
  });
}
