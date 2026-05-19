"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

export interface Matter {
  id: string;
  sector_id: string;
  contract_id: string | null;
  title: string;
  matter_type: string;
  priority: string;
  status: string;
  description: string | null;
  requested_by: string;
  assigned_to: string | null;
  due_date: string | null;
  resolved_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useMatters(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["legal-matters", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];

      let query = supabase
        .from("legal_matters")
        .select("*")
        .eq("is_active", true);

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;
      return (data as Matter[]) ?? [];
    },
    enabled: isScopeReady(scope),
  });
}
