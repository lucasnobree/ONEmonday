"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
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
