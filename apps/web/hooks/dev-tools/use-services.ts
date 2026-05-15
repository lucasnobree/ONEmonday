"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createService,
  updateService,
  deleteService,
} from "@/lib/actions/dev-tools/services";

export interface DevService {
  id: string;
  sector_id: string;
  name: string;
  slug: string;
  description: string | null;
  environment: string;
  criticality: string;
  health: string;
  repository_url: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useServices(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dev-services", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("dev_services")
        .select("*")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return (data as DevService[]) ?? [];
    },
    enabled: !!sectorId,
  });
}

function useServiceInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["dev-services"] });
    queryClient.invalidateQueries({ queryKey: ["dev-tools-stats"] });
  };
}

export function useCreateService() {
  const invalidate = useServiceInvalidation();
  return useMutation({
    mutationFn: (input: unknown) => createService(input),
    onSuccess: invalidate,
  });
}

export function useUpdateService() {
  const invalidate = useServiceInvalidation();
  return useMutation({
    mutationFn: (input: unknown) => updateService(input),
    onSuccess: invalidate,
  });
}

export function useDeleteService() {
  const invalidate = useServiceInvalidation();
  return useMutation({
    mutationFn: (id: string) => deleteService(id),
    onSuccess: invalidate,
  });
}
