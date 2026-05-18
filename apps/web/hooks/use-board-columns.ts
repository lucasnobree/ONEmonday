"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createBoardColumn,
  updateBoardColumn,
  reorderBoardColumns,
  deleteBoardColumn,
} from "@/lib/actions/board-columns";

/**
 * Mutations for board column management (add / rename / recolour / WIP /
 * reorder / delete). Every mutation invalidates the board query so the
 * Kanban re-renders with the new column set.
 */
export function useBoardColumnMutations(boardId: string) {
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["board", boardId] });

  const create = useMutation({
    mutationFn: (input: unknown) => createBoardColumn(input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (input: unknown) => updateBoardColumn(input),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: (input: unknown) => reorderBoardColumns(input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (columnId: string) => deleteBoardColumn(columnId),
    onSuccess: invalidate,
  });

  return { create, update, reorder, remove };
}
