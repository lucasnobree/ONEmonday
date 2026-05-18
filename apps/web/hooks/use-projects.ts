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

/** Project lifecycle status -> pt-BR label + badge classes. */
export const PROJECT_STATUS_CONFIG = {
  active: {
    label: "Ativo",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  paused: {
    label: "Pausado",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  completed: {
    label: "Concluído",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  archived: {
    label: "Arquivado",
    className:
      "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
  },
} as const;

/** Project health (RYG) -> pt-BR label + dot/text classes. */
export const PROJECT_HEALTH_CONFIG = {
  on_track: {
    label: "No prazo",
    dotClassName: "bg-emerald-500",
    textClassName: "text-emerald-600 dark:text-emerald-400",
  },
  at_risk: {
    label: "Em risco",
    dotClassName: "bg-amber-500",
    textClassName: "text-amber-600 dark:text-amber-400",
  },
  off_track: {
    label: "Atrasado",
    dotClassName: "bg-red-500",
    textClassName: "text-red-600 dark:text-red-400",
  },
} as const;

export type ProjectHealth = keyof typeof PROJECT_HEALTH_CONFIG;

/** A project tile enriched with its linked-card rollup. */
export interface ProjectListItem extends ProjectSummary {
  cardCount: number;
  doneCount: number;
}

interface RawProjectCardCount {
  project_id: string;
  cards: { completed_at: string | null; is_active: boolean } | null;
}

export function useProjects(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery<ProjectListItem[]>({
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

      const projects = (data ?? []).flatMap((ps) =>
        ps.projects ? [ps.projects as unknown as ProjectSummary] : []
      );
      if (projects.length === 0) return [];

      // Resolve a done/total rollup per project from project_cards. A
      // separate query (not an !inner join) so RLS on cards never silently
      // collapses the tile list.
      const { data: links } = await supabase
        .from("project_cards")
        .select("project_id, cards ( completed_at, is_active )")
        .in(
          "project_id",
          projects.map((p) => p.id)
        );

      const counts = new Map<string, { total: number; done: number }>();
      for (const row of (links ?? []) as unknown as RawProjectCardCount[]) {
        if (!row.cards || !row.cards.is_active) continue;
        const entry = counts.get(row.project_id) ?? { total: 0, done: 0 };
        entry.total += 1;
        if (row.cards.completed_at != null) entry.done += 1;
        counts.set(row.project_id, entry);
      }

      return projects.map<ProjectListItem>((p) => ({
        ...p,
        cardCount: counts.get(p.id)?.total ?? 0,
        doneCount: counts.get(p.id)?.done ?? 0,
      }));
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
