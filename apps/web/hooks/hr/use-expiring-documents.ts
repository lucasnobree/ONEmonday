"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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
 */
export function useExpiringDocuments(
  sectorId: string | undefined,
  withinDays = 30
) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-expiring-documents", sectorId, withinDays],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase.rpc("get_expiring_hr_documents", {
        p_sector_id: sectorId,
        p_within_days: withinDays,
      });

      if (error) throw error;
      return (data as ExpiringDocument[]) ?? [];
    },
    enabled: !!sectorId,
  });
}
