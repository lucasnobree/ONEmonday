"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

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

export function useCRMStats(scope: SectorScope | undefined) {
  return useQuery<CRMStats>({
    queryKey: ["crm-stats", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return EMPTY_STATS;

      const supabase = createClient();
      const filterSectorId = sectorFilterValue(scope);

      // Active deals: no actual_close_date
      let activeQuery = supabase
        .from("crm_deals")
        .select("id", { count: "exact", head: true })
        .is("actual_close_date", null)
        .eq("is_active", true);
      if (filterSectorId)
        activeQuery = activeQuery.eq("sector_id", filterSectorId);

      // Pipeline value: sum of value where deal is open
      let pipelineQuery = supabase
        .from("crm_deals")
        .select("value")
        .is("actual_close_date", null)
        .eq("is_active", true);
      if (filterSectorId)
        pipelineQuery = pipelineQuery.eq("sector_id", filterSectorId);

      // Won deals: actual_close_date set and no lost_reason
      let wonQuery = supabase
        .from("crm_deals")
        .select("id", { count: "exact", head: true })
        .not("actual_close_date", "is", null)
        .is("lost_reason", null)
        .eq("is_active", true);
      if (filterSectorId) wonQuery = wonQuery.eq("sector_id", filterSectorId);

      // Total contacts
      let contactsQuery = supabase
        .from("crm_contacts")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      if (filterSectorId)
        contactsQuery = contactsQuery.eq("sector_id", filterSectorId);

      const [activeRes, pipelineRes, wonRes, contactsRes] = await Promise.all([
        activeQuery,
        pipelineQuery,
        wonQuery,
        contactsQuery,
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
    enabled: isScopeReady(scope),
    staleTime: 60 * 1000,
  });
}
