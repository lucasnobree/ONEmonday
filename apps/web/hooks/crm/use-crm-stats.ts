"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface CRMStats {
  activeDeals: number;
  pipelineValue: number;
  wonDeals: number;
  totalContacts: number;
}

const EMPTY_STATS: CRMStats = {
  activeDeals: 0,
  pipelineValue: 0,
  wonDeals: 0,
  totalContacts: 0,
};

export function useCRMStats(sectorId: string | undefined) {
  return useQuery<CRMStats>({
    queryKey: ["crm-stats", sectorId],
    queryFn: async () => {
      if (!sectorId) return EMPTY_STATS;

      const supabase = createClient();

      const [activeRes, pipelineRes, wonRes, contactsRes] = await Promise.all([
        // Active deals: no actual_close_date
        supabase
          .from("crm_deals")
          .select("id", { count: "exact", head: true })
          .eq("sector_id", sectorId)
          .is("actual_close_date", null)
          .eq("is_active", true),

        // Pipeline value: sum of value where deal is open
        supabase
          .from("crm_deals")
          .select("value")
          .eq("sector_id", sectorId)
          .is("actual_close_date", null)
          .eq("is_active", true),

        // Won deals: actual_close_date set and no lost_reason
        supabase
          .from("crm_deals")
          .select("id", { count: "exact", head: true })
          .eq("sector_id", sectorId)
          .not("actual_close_date", "is", null)
          .is("lost_reason", null)
          .eq("is_active", true),

        // Total contacts
        supabase
          .from("crm_contacts")
          .select("id", { count: "exact", head: true })
          .eq("sector_id", sectorId)
          .eq("is_active", true),
      ]);

      const pipelineValue = (pipelineRes.data ?? []).reduce(
        (sum, d) => sum + (Number(d.value) || 0),
        0
      );

      return {
        activeDeals: activeRes.count ?? 0,
        pipelineValue,
        wonDeals: wonRes.count ?? 0,
        totalContacts: contactsRes.count ?? 0,
      };
    },
    enabled: !!sectorId,
    staleTime: 60 * 1000,
  });
}
