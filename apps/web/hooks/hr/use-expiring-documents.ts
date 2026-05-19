"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
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
 * HR documents (across the sector) that expire within `withinDays`,
 * including already-expired ones. Backed by the get_expiring_hr_documents RPC.
 *
 * The RPC is single-sector by contract (`p_sector_id`), so under the
 * all-sectors scope this hook resolves to an empty list.
 */
export function useExpiringDocuments(
  scope: SectorScope | undefined,
  withinDays = 30
) {
  const supabase = createClient();
  const sectorId = scope ? sectorFilterValue(scope) : undefined;

  return useQuery({
    queryKey: ["hr-expiring-documents", scope, withinDays],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase.rpc("get_expiring_hr_documents", {
        p_sector_id: sectorId,
        p_within_days: withinDays,
      });

      if (error) throw error;
      return (data as ExpiringDocument[]) ?? [];
    },
    enabled: isScopeReady(scope),
  });
}
