"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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

export function useMatters(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["legal-matters", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("legal_matters")
        .select("*")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as Matter[]) ?? [];
    },
    enabled: !!sectorId,
  });
}
