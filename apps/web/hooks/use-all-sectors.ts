"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { NavSector } from "@/lib/navigation/sector-tree";

interface SectorRow {
  id: string;
  slug: string;
  name: string;
}

/**
 * Fetches every sector in the account.
 *
 * Only needed for the sidebar's global-admin case — an admin sees a tree
 * branch for *every* sector, not just the ones their `sectorRoles` grant.
 * Non-admins build their tree from `usePermissions().sectorRoles` instead,
 * so they never trigger this query.
 */
async function fetchAllSectors(): Promise<NavSector[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sectors")
    .select("id, slug, name")
    .order("name");

  if (error) throw error;
  return ((data ?? []) as SectorRow[]).map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
  }));
}

/**
 * React Query wrapper around {@link fetchAllSectors}. Disabled unless
 * `enabled` is true so non-admin sidebars never run the query.
 */
export function useAllSectors(enabled: boolean) {
  const { data, isLoading, error } = useQuery<NavSector[]>({
    queryKey: ["all-sectors"],
    queryFn: fetchAllSectors,
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  return { sectors: data ?? [], isLoading, error };
}
