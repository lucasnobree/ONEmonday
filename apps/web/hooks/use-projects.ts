"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createProject,
  updateProject,
  deleteProject,
} from "@/lib/actions/projects";
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from "@/lib/validations/projects";

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string | null;
  target_date: string | null;
  created_by: string;
  is_active: boolean | null;
  created_at: string;
  updated_at: string | null;
}

export function useProjects(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery<ProjectSummary[]>({
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
      return (
        (data ?? []).flatMap((ps) =>
          ps.projects ? [ps.projects as unknown as ProjectSummary] : []
        )
      );
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

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProjectInput) => updateProject(input),
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
