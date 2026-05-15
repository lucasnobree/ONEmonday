"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface DevIncident {
  id: string;
  sector_id: string;
  service_id: string | null;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  assigned_to: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useIncidents(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dev-incidents", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("dev_incidents")
        .select("*")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as DevIncident[]) ?? [];
    },
    enabled: !!sectorId,
  });
}
