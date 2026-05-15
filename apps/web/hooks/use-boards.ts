"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createBoard, updateBoard, deleteBoard } from "@/lib/actions/boards";
import type {
  CreateBoardInput,
  UpdateBoardInput,
} from "@/lib/validations/boards";

export interface BoardSummary {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  is_default: boolean | null;
  created_by: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string | null;
}

export function useBoards(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery<BoardSummary[]>({
    queryKey: ["boards", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("board_sectors")
        .select(
          `
          board_id,
          boards!inner (
            id, name, description, visibility, is_default, created_by, is_active, created_at, updated_at
          )
        `
        )
        .eq("sector_id", sectorId)
        .eq("boards.is_active", true);

      if (error) throw error;
      return (
        (data ?? []).flatMap((bs) =>
          bs.boards ? [bs.boards as unknown as BoardSummary] : []
        )
      );
    },
    enabled: !!sectorId,
  });
}

export function useCreateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBoardInput) => createBoard(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
    },
  });
}

export function useUpdateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateBoardInput) => updateBoard(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
    },
  });
}

export function useDeleteBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (boardId: string) => deleteBoard(boardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
    },
  });
}
