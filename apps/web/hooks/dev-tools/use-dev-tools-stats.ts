"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

export interface DevToolsStats {
  openIncidents: number;
  sev1Open: number;
  servicesDown: number;
  deploys7d: number;
  activeFlags: number;
}

const EMPTY_STATS: DevToolsStats = {
  openIncidents: 0,
  sev1Open: 0,
  servicesDown: 0,
  deploys7d: 0,
  activeFlags: 0,
};

interface RawDevToolsStats {
  open_incidents: number;
  sev1_open: number;
  services_down: number;
  deploys_7d: number;
  active_flags: number;
}

/**
 * Dev-Tools dashboard KPIs from the `get_dev_tools_dashboard_stats` RPC. The
 * RPC is single-sector by contract (`p_sector_id`), so under the all-sectors
 * scope this hook resolves to the empty stat set.
 */
export function useDevToolsStats(scope: SectorScope | undefined) {
  const sectorId = scope ? sectorFilterValue(scope) : undefined;

  return useQuery<DevToolsStats>({
    queryKey: ["dev-tools-stats", scope],
    queryFn: async () => {
      if (!sectorId) return EMPTY_STATS;

      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        "get_dev_tools_dashboard_stats",
        { p_sector_id: sectorId }
      );

      if (error) throw error;

      const raw = data as RawDevToolsStats | null;
      if (!raw) return EMPTY_STATS;

      return {
        openIncidents: raw.open_incidents ?? 0,
        sev1Open: raw.sev1_open ?? 0,
        servicesDown: raw.services_down ?? 0,
        deploys7d: raw.deploys_7d ?? 0,
        activeFlags: raw.active_flags ?? 0,
      };
    },
    enabled: isScopeReady(scope),
    staleTime: 60 * 1000,
  });
}
