"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

export interface Clause {
  id: string;
  sector_id: string;
  title: string;
  category: string;
  body: string;
  is_approved: boolean;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useClauses(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["legal-clauses", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];

      let query = supabase
        .from("legal_clauses")
        .select("*")
        .eq("is_active", true)
        .order("title", { ascending: true });

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query;

      if (error) throw error;
      return (data as Clause[]) ?? [];
    },
    enabled: isScopeReady(scope),
  });
}
