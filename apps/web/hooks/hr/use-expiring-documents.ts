"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { isScopeReady, rpcSectorParam } from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

export interface ExpiringDocument {
  id: string;
  employee_id: string;
  employee_name: string;
  name: string;
  category: string;
  expiry_date: string;
  days_until_expiry: number;
}

/**
 * HR documents that expire within `withinDays`, including already-expired
 * ones. Backed by the get_expiring_hr_documents RPC.
 *
 * The RPC accepts a nullable `p_sector_id`: under the all-sectors scope this
 * hook passes `null` and the RPC returns a cross-sector aggregate (admin-only,
 * enforced server-side).
 */
export function useExpiringDocuments(
  scope: SectorScope | undefined,
  withinDays = 30
) {
  const supabase = createClient();
  const sectorParam = rpcSectorParam(scope);

  return useQuery({
    queryKey: ["hr-expiring-documents", scope, withinDays],
    queryFn: async () => {
      if (sectorParam === undefined) return [];

      const { data, error } = await supabase.rpc("get_expiring_hr_documents", {
        p_sector_id: sectorParam,
        p_within_days: withinDays,
      });

      if (error) throw error;
      return (data as ExpiringDocument[]) ?? [];
    },
    enabled: isScopeReady(scope),
  });
}
