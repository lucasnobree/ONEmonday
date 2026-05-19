"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";
import {
  createDeployment,
  updateDeployment,
  deleteDeployment,
} from "@/lib/actions/dev-tools/deployments";

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

export function useDeployments(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dev-deployments", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];

      let query = supabase.from("dev_deployments").select("*");

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query.order("deployed_at", {
        ascending: false,
      });

      if (error) throw error;
      return (data as DevDeployment[]) ?? [];
    },
    enabled: isScopeReady(scope),
  });
}

function useDeploymentInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["dev-deployments"] });
    queryClient.invalidateQueries({ queryKey: ["dev-tools-stats"] });
  };
}

export function useCreateDeployment() {
  const invalidate = useDeploymentInvalidation();
  return useMutation({
    mutationFn: (input: unknown) => createDeployment(input),
    onSuccess: invalidate,
  });
}

export function useUpdateDeployment() {
  const invalidate = useDeploymentInvalidation();
  return useMutation({
    mutationFn: (input: unknown) => updateDeployment(input),
    onSuccess: invalidate,
  });
}

export function useDeleteDeployment() {
  const invalidate = useDeploymentInvalidation();
  return useMutation({
    mutationFn: (id: string) => deleteDeployment(id),
    onSuccess: invalidate,
  });
}
