"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface DevDeployment {
  id: string;
  sector_id: string;
  service_id: string;
  version: string;
  environment: string;
  status: string;
  notes: string | null;
  deployed_by: string;
  deployed_at: string;
  created_at: string;
  updated_at: string;
}

export function useDeployments(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dev-deployments", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("dev_deployments")
        .select("*")
        .eq("sector_id", sectorId)
        .order("deployed_at", { ascending: false });

      if (error) throw error;
      return (data as DevDeployment[]) ?? [];
    },
    enabled: !!sectorId,
  });
}
