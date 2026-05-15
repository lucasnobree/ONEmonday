"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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

export function useLegalStats(sectorId: string | undefined) {
  return useQuery<LegalStats>({
    queryKey: ["legal-stats", sectorId],
    queryFn: async () => {
      if (!sectorId) return EMPTY_STATS;

      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_legal_dashboard_stats", {
        p_sector_id: sectorId,
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
    enabled: !!sectorId,
    staleTime: 60 * 1000,
  });
}
