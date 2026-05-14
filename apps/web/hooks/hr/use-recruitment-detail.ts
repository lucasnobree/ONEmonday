"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface RecruitmentCandidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface RecruitmentColumn {
  id: string;
  name: string;
  color: string | null;
  position: number;
  candidates: RecruitmentCandidate[];
}

export interface RecruitmentBoard {
  id: string;
  name: string;
}

export interface RecruitmentBoardData {
  board: RecruitmentBoard;
  columns: RecruitmentColumn[];
}

export function useRecruitmentBoard(openingId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-recruitment-board", openingId],
    queryFn: async (): Promise<RecruitmentBoardData | null> => {
      if (!openingId) return null;

      const { data: board, error: boardError } = await supabase
        .from("hr_recruitment_boards")
        .select("id, name")
        .eq("opening_id", openingId)
        .maybeSingle();

      if (boardError) throw boardError;
      if (!board) return null;

      const { data: columns, error: colError } = await supabase
        .from("hr_recruitment_columns")
        .select(
          `
          id, name, color, position,
          hr_recruitment_candidates (
            id, full_name, email, phone, notes, created_at, is_active
          )
        `
        )
        .eq("board_id", board.id)
        .order("position", { ascending: true });

      if (colError) throw colError;

      return {
        board: { id: board.id, name: board.name },
        columns: (columns ?? []).map((col) => ({
          id: col.id,
          name: col.name,
          color: col.color,
          position: col.position,
          candidates: (
            (col.hr_recruitment_candidates ?? []) as (RecruitmentCandidate & { is_active: boolean })[]
          ).filter((c) => c.is_active !== false),
        })),
      };
    },
    enabled: !!openingId,
  });
}
