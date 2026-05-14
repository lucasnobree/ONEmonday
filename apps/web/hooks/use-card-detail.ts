"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface CardDetail {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  start_date: string | null;
  position: number;
  column_id: string;
  board_id: string;
  sector_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  board_columns: { name: string } | null;
  card_assignees: Array<{
    user_id: string;
    users: { full_name: string; avatar_url: string | null } | null;
  }>;
  card_tags: Array<{
    tags: { id: string; name: string; color: string } | null;
  }>;
  card_comments: Array<{
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    is_active: boolean;
    users: { full_name: string; avatar_url: string | null } | null;
  }>;
  card_checklists: Array<{
    id: string;
    title: string;
    position: number;
    checklist_items: Array<{
      id: string;
      content: string;
      is_completed: boolean;
      completed_by: string | null;
      position: number;
    }>;
  }>;
  card_attachments: Array<{
    id: string;
    file_url: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    uploaded_by: string;
    created_at: string;
  }>;
  card_activity_log: Array<{
    id: string;
    action: string;
    metadata: Record<string, unknown>;
    created_at: string;
    user_id: string;
    users: { full_name: string } | null;
  }>;
  card_cross_references: Array<{
    id: string;
    target_card_id: string;
    reference_type: string;
    status: string;
    created_at: string;
    cards: {
      title: string;
      sector_id: string;
      sectors: { name: string } | null;
    } | null;
  }>;
}

export function useCardDetail(cardId: string | null) {
  const supabase = createClient();

  return useQuery<CardDetail>({
    queryKey: ["card-detail", cardId],
    queryFn: async () => {
      if (!cardId) throw new Error("Card ID required");

      const { data: card, error } = await supabase
        .from("cards")
        .select(`
          id, title, description, priority, due_date, start_date, position,
          column_id, board_id, sector_id, created_by, created_at, updated_at,
          board_columns(name),
          card_assignees(user_id, users(full_name, avatar_url)),
          card_tags(tags(id, name, color)),
          card_comments(id, content, created_at, user_id, is_active, users(full_name, avatar_url)),
          card_checklists(id, title, position,
            checklist_items(id, content, is_completed, completed_by, position)
          ),
          card_attachments(id, file_url, file_name, file_size, mime_type, uploaded_by, created_at),
          card_activity_log(id, action, metadata, created_at, user_id, users(full_name)),
          card_cross_references!card_cross_references_source_card_id_fkey(
            id, target_card_id, reference_type, status, created_at,
            cards!card_cross_references_target_card_id_fkey(title, sector_id, sectors(name))
          )
        `)
        .eq("id", cardId)
        .single();

      if (error) throw error;
      return card as unknown as CardDetail;
    },
    enabled: !!cardId,
  });
}
