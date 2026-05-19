"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { isScopeReady, rpcSectorParam } from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

export interface LegalStats {
  activeContracts: number;
  expiring30: number;
  openMatters: number;
  draftContracts: number;
}

const EMPTY_STATS: LegalStats = {
  activeContracts: 0,
  expiring30: 0,
  openMatters: 0,
  draftContracts: 0,
};

interface RawLegalStats {
  active_contracts: number;
  expiring_30: number;
  open_matters: number;
  draft_contracts: number;
}

/**
 * Legal dashboard KPIs from the `get_legal_dashboard_stats` RPC. The RPC
 * accepts a nullable `p_sector_id`: under the all-sectors scope this hook
 * passes `null` and the RPC returns a cross-sector aggregate (admin-only,
 * enforced server-side).
 */
export function useLegalStats(scope: SectorScope | undefined) {
  const sectorParam = rpcSectorParam(scope);

  return useQuery<LegalStats>({
    queryKey: ["legal-stats", scope],
    queryFn: async () => {
      if (sectorParam === undefined) return EMPTY_STATS;

      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_legal_dashboard_stats", {
        p_sector_id: sectorParam,
      });

      if (error) throw error;

      const raw = data as RawLegalStats | null;
      if (!raw) return EMPTY_STATS;

      return {
        activeContracts: raw.active_contracts ?? 0,
        expiring30: raw.expiring_30 ?? 0,
        openMatters: raw.open_matters ?? 0,
        draftContracts: raw.draft_contracts ?? 0,
      };
    },
    enabled: isScopeReady(scope),
    staleTime: 60 * 1000,
  });
}
