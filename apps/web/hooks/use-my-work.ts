"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { BucketableTask } from "@/lib/my-work/date-buckets";

/**
 * One task in the "Meu Trabalho" cross-board view: a card assigned to the
 * current user, carrying enough board / sector / column context to render a
 * row and link back to its board.
 */
export interface MyWorkItem extends BucketableTask {
  cardId: string;
  title: string;
  priority: "critical" | "high" | "medium" | "low";
  dueDate: string | null;
  boardId: string;
  boardName: string;
  sectorId: string;
  sectorName: string;
  sectorSlug: string;
  columnName: string;
  columnColor: string | null;
  /** True when the card sits in a column flagged `is_done_column`. */
  isDone: boolean;
}

/** Raw shape of an assignee row with its nested card / board / column joins. */
interface RawAssigneeRow {
  cards: {
    id: string;
    title: string;
    priority: string | null;
    due_date: string | null;
    is_active: boolean | null;
    board_id: string;
    sector_id: string;
    boards: { id: string; name: string; is_active: boolean | null } | null;
    sectors: { id: string; name: string; slug: string } | null;
    board_columns: {
      name: string;
      color: string | null;
      is_done_column: boolean | null;
    } | null;
  } | null;
}

const PRIORITY_RANK: Record<MyWorkItem["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Maps the raw join result into {@link MyWorkItem}s, dropping rows whose card,
 * board or sector could not be resolved (inactive, or hidden by RLS).
 */
export function mapMyWorkRows(rows: RawAssigneeRow[]): MyWorkItem[] {
  const items: MyWorkItem[] = [];
  for (const row of rows) {
    const card = row.cards;
    if (!card || card.is_active === false) continue;
    const board = card.boards;
    const sector = card.sectors;
    const column = card.board_columns;
    if (!board || board.is_active === false || !sector) continue;

    items.push({
      cardId: card.id,
      title: card.title,
      priority: (card.priority ?? "medium") as MyWorkItem["priority"],
      dueDate: card.due_date,
      boardId: board.id,
      boardName: board.name,
      sectorId: sector.id,
      sectorName: sector.name,
      sectorSlug: sector.slug,
      columnName: column?.name ?? "—",
      columnColor: column?.color ?? null,
      isDone: column?.is_done_column ?? false,
    });
  }
  return items;
}

/**
 * Stable sort for tasks inside a date bucket: earlier due dates first, then
 * higher priority, then title. Cards with no due date sort last. Pure and
 * exported so the ordering can be unit-tested.
 */
export function sortMyWorkItems(items: readonly MyWorkItem[]): MyWorkItem[] {
  return [...items].sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rank !== 0) return rank;
    return a.title.localeCompare(b.title, "pt-BR");
  });
}

async function fetchMyWork(): Promise<MyWorkItem[]> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("card_assignees")
    .select(
      `
      cards!inner (
        id, title, priority, due_date, is_active, board_id, sector_id,
        boards!inner ( id, name, is_active ),
        sectors!inner ( id, name, slug ),
        board_columns!inner ( name, color, is_done_column )
      )
      `
    )
    .eq("user_id", user.id)
    .eq("cards.is_active", true)
    .eq("cards.boards.is_active", true);

  if (error) throw error;

  return sortMyWorkItems(
    mapMyWorkRows((data ?? []) as unknown as RawAssigneeRow[])
  );
}

/**
 * Loads every active card assigned to the signed-in user, across all boards
 * and sectors, for the "Meu Trabalho" screen. RLS still scopes the result to
 * cards the user is allowed to read.
 */
export function useMyWork() {
  return useQuery<MyWorkItem[]>({
    queryKey: ["my-work"],
    queryFn: fetchMyWork,
    staleTime: 60 * 1000,
  });
}
