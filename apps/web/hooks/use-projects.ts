"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createProject,
  updateProject,
  deleteProject,
} from "@/lib/actions/projects";
import type { CreateProjectInput } from "@/lib/validations/projects";

export function useProjects(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["projects", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("project_sectors")
        .select(
          `
          project_id,
          projects!inner (
            id, name, description, status, start_date, target_date, created_by, is_active, created_at, updated_at
          )
        `
        )
        .eq("sector_id", sectorId)
        .eq("projects.is_active", true);

      if (error) throw error;
      return data?.map((ps) => ps.projects).flat() ?? [];
    },
    enabled: !!sectorId,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
