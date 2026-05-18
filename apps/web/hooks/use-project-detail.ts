"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { linkProjectCard, unlinkProjectCard } from "@/lib/actions/projects";
import {
  addProjectMember,
  removeProjectMember,
} from "@/lib/actions/project-members";
import type { ProjectSummary } from "@/hooks/use-projects";

/** A card linked to a project, with just the fields the detail page renders. */
export interface ProjectCard {
  id: string;
  title: string;
  priority: "critical" | "high" | "medium" | "low";
  due_date: string | null;
  completed_at: string | null;
  board_id: string;
  sector_id: string;
  column: { name: string; is_done_column: boolean } | null;
}

/** A member of a project's roster. */
export interface ProjectMember {
  user_id: string;
  role: "lead" | "member";
  full_name: string;
  avatar_url: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  sectorIds: string[];
  cards: ProjectCard[];
  members: ProjectMember[];
  /** Coarse RYG health signal (defaults to "on_track"). */
  health: "on_track" | "at_risk" | "off_track";
  /** Free-text "where things stand" note, or null. */
  status_note: string | null;
}

/** Pure progress rollup over a project's linked cards. Exported for tests. */
export interface ProjectProgress {
  total: number;
  done: number;
  /** Completion ratio 0-100, rounded; 0 when there are no cards. */
  percent: number;
}

export function computeProjectProgress(cards: ProjectCard[]): ProjectProgress {
  const total = cards.length;
  const done = cards.filter(
    (c) => c.completed_at != null || c.column?.is_done_column === true
  ).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, percent };
}

/** True when an `active` project's target date is in the past. */
export function isProjectOverdue(
  status: string,
  targetDate: string | null
): boolean {
  if (status !== "active" || !targetDate) return false;
  const target = new Date(targetDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return target.getTime() < today.getTime();
}

interface RawProjectCardRow {
  card_id: string;
  cards: {
    id: string;
    title: string;
    priority: string | null;
    due_date: string | null;
    completed_at: string | null;
    board_id: string;
    sector_id: string;
    is_active: boolean;
    board_columns: { name: string; is_done_column: boolean | null } | null;
  } | null;
}

export function useProjectDetail(projectId: string | undefined) {
  const supabase = createClient();

  return useQuery<ProjectDetail | null>({
    queryKey: ["project-detail", projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select(
          "id, name, description, status, health, status_note, start_date, target_date, created_by, is_active, created_at, updated_at"
        )
        .eq("id", projectId)
        .eq("is_active", true)
        .single();
      if (projectError) throw projectError;

      const { data: sectors } = await supabase
        .from("project_sectors")
        .select("sector_id")
        .eq("project_id", projectId);

      const { data: memberRows } = await supabase
        .from("project_members")
        .select("user_id, role, users ( full_name, avatar_url )")
        .eq("project_id", projectId);

      const { data: links, error: linksError } = await supabase
        .from("project_cards")
        .select(
          `
          card_id,
          cards (
            id, title, priority, due_date, completed_at, board_id, sector_id, is_active,
            board_columns ( name, is_done_column )
          )
        `
        )
        .eq("project_id", projectId);
      if (linksError) throw linksError;

      const cards = ((links ?? []) as unknown as RawProjectCardRow[])
        .map((row) => row.cards)
        .filter(
          (c): c is NonNullable<RawProjectCardRow["cards"]> =>
            c != null && c.is_active
        )
        .map<ProjectCard>((c) => ({
          id: c.id,
          title: c.title,
          priority: (c.priority ?? "medium") as ProjectCard["priority"],
          due_date: c.due_date,
          completed_at: c.completed_at,
          board_id: c.board_id,
          sector_id: c.sector_id,
          column: c.board_columns
            ? {
                name: c.board_columns.name,
                is_done_column: c.board_columns.is_done_column ?? false,
              }
            : null,
        }));

      const members = (
        (memberRows ?? []) as unknown as RawProjectMemberRow[]
      ).map<ProjectMember>((row) => ({
        user_id: row.user_id,
        role: (row.role === "lead" ? "lead" : "member") as ProjectMember["role"],
        full_name: row.users?.full_name ?? "",
        avatar_url: row.users?.avatar_url ?? null,
      }));

      const raw = project as ProjectSummary & {
        health: string | null;
        status_note: string | null;
      };

      return {
        ...(project as ProjectSummary),
        sectorIds: (sectors ?? []).map((s) => s.sector_id),
        cards,
        members,
        health: (raw.health ?? "on_track") as ProjectDetail["health"],
        status_note: raw.status_note ?? null,
      };
    },
    enabled: !!projectId,
  });
}

interface RawProjectMemberRow {
  user_id: string;
  role: string;
  users: { full_name: string; avatar_url: string | null } | null;
}

/** Board cards in the project's sectors that are not yet linked. */
export interface LinkableCard {
  id: string;
  title: string;
  board_id: string;
  board_name: string;
}

export function useLinkableCards(
  sectorIds: string[] | undefined,
  linkedCardIds: Set<string>,
  enabled: boolean
) {
  const supabase = createClient();

  return useQuery<LinkableCard[]>({
    queryKey: ["linkable-cards", sectorIds],
    queryFn: async () => {
      if (!sectorIds || sectorIds.length === 0) return [];

      const { data, error } = await supabase
        .from("cards")
        .select("id, title, board_id, boards ( name )")
        .in("sector_id", sectorIds)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      return ((data ?? []) as unknown as {
        id: string;
        title: string;
        board_id: string;
        boards: { name: string } | null;
      }[]).map((c) => ({
        id: c.id,
        title: c.title,
        board_id: c.board_id,
        board_name: c.boards?.name ?? "",
      }));
    },
    enabled: enabled && !!sectorIds && sectorIds.length > 0,
    select: (cards) => cards.filter((c) => !linkedCardIds.has(c.id)),
  });
}

export function useLinkProjectCard(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => linkProjectCard({ projectId, cardId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-detail", projectId],
      });
    },
  });
}

export function useUnlinkProjectCard(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => unlinkProjectCard({ projectId, cardId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-detail", projectId],
      });
    },
  });
}

export function useAddProjectMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role: "lead" | "member" }) =>
      addProjectMember({ projectId, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-detail", projectId],
      });
    },
  });
}

export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      removeProjectMember({ projectId, userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-detail", projectId],
      });
    },
  });
}
