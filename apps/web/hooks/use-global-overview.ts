"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  mapSectorOverviewRows,
  type RawSectorOverviewRow,
  type SectorOverviewRow,
} from "@/lib/overview/aggregate";

async function fetchGlobalOverview(): Promise<SectorOverviewRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_global_sector_overview");
  if (error) throw error;
  return mapSectorOverviewRows(
    (data ?? []) as unknown as RawSectorOverviewRow[]
  );
}

/**
 * Loads one cross-sector overview row per sector for the admin "Visão Geral"
 * screen, backed by the `get_global_sector_overview` RPC (migration 00208).
 *
 * The RPC is admin-only and returns an empty set for non-admins, so the hook
 * is additionally gated by `enabled` to avoid a pointless round trip.
 */
export function useGlobalOverview(enabled = true) {
  return useQuery<SectorOverviewRow[]>({
    queryKey: ["global-sector-overview"],
    queryFn: fetchGlobalOverview,
    enabled,
    staleTime: 60 * 1000,
  });
}
