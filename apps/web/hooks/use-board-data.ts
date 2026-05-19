"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface BoardColumn {
  id: string;
  name: string;
  color: string | null;
  position: number;
  wip_limit: number | null;
  is_done_column: boolean;
}

export interface BoardCard {
  id: string;
  title: string;
  description: string | null;
  position: number;
  priority: "critical" | "high" | "medium" | "low";
  due_date: string | null;
  column_id: string;
  sector_id: string;
  created_by: string;
  created_at: string;
  assignees: {
    user_id: string;
    full_name: string;
    avatar_url: string | null;
  }[];
  tags: { id: string; name: string; color: string }[];
  cross_ref_count: number;
  /** Number of active updates/comments on the card — footer `💬 N`. */
  comment_count: number;
}

export interface BoardData {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
  columns: (BoardColumn & { cards: BoardCard[] })[];
}

/** Raw shape of a card row with its nested joins from the Supabase query. */
interface RawCardRow {
  id: string;
  title: string;
  description: string | null;
  position: number;
  priority: string | null;
  due_date: string | null;
  column_id: string;
  sector_id: string;
  created_by: string;
  created_at: string;
  card_assignees:
    | {
        user_id: string;
        users: { full_name: string; avatar_url: string | null } | null;
      }[]
    | null;
  card_tags:
    | { tags: { id: string; name: string; color: string } | null }[]
    | null;
  card_cross_references: { id: string }[] | null;
  card_comments: { id: string }[] | null;
}

export function useBoardData(boardId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["board", boardId],
    queryFn: async (): Promise<BoardData> => {
      if (!boardId) throw new Error("Board ID required");

      const { data: board, error: boardError } = await supabase
        .from("boards")
        .select("id, name, description, updated_at")
        .eq("id", boardId)
        .eq("is_active", true)
        .single();
      if (boardError) throw boardError;

      const { data: columns, error: colError } = await supabase
        .from("board_columns")
        .select("id, name, color, position, wip_limit, is_done_column")
        .eq("board_id", boardId)
        .order("position");
      if (colError) throw colError;

      const { data: cards, error: cardError } = await supabase
        .from("cards")
        .select(
          `
          id, title, description, position, priority, due_date, column_id, sector_id, created_by, created_at,
          card_assignees ( user_id, users ( full_name, avatar_url ) ),
          card_tags ( tags ( id, name, color ) ),
          card_cross_references!card_cross_references_source_card_id_fkey ( id ),
          card_comments ( id )
        `
        )
        .eq("board_id", boardId)
        .eq("is_active", true)
        .order("position");
      if (cardError) throw cardError;

      const rawCards = (cards ?? []) as unknown as RawCardRow[];

      const columnsWithCards = (columns ?? []).map((col) => ({
        ...col,
        is_done_column: col.is_done_column ?? false,
        cards: rawCards
          .filter((card) => card.column_id === col.id)
          .map<BoardCard>((card) => ({
            id: card.id,
            title: card.title,
            description: card.description,
            position: card.position,
            priority: (card.priority ?? "medium") as BoardCard["priority"],
            due_date: card.due_date,
            column_id: card.column_id,
            sector_id: card.sector_id,
            created_by: card.created_by,
            created_at: card.created_at,
            assignees: (card.card_assignees ?? []).map((a) => ({
              user_id: a.user_id,
              full_name: a.users?.full_name ?? "",
              avatar_url: a.users?.avatar_url ?? null,
            })),
            tags: (card.card_tags ?? [])
              .map((t) => t.tags)
              .filter((t): t is NonNullable<typeof t> => t !== null)
              .map((t) => ({ id: t.id, name: t.name, color: t.color })),
            cross_ref_count: (card.card_cross_references ?? []).length,
            comment_count: (card.card_comments ?? []).length,
          })),
      }));

      return {
        ...board,
        updated_at: board.updated_at ?? new Date().toISOString(),
        columns: columnsWithCards,
      };
    },
    enabled: !!boardId,
  });
}
