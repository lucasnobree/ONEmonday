"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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

export function useClauses(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["legal-clauses", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("legal_clauses")
        .select("*")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("title", { ascending: true });

      if (error) throw error;
      return (data as Clause[]) ?? [];
    },
    enabled: !!sectorId,
  });
}
