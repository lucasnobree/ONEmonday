"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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

export function useDevToolsStats(sectorId: string | undefined) {
  return useQuery<DevToolsStats>({
    queryKey: ["dev-tools-stats", sectorId],
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
    enabled: !!sectorId,
    staleTime: 60 * 1000,
  });
}
