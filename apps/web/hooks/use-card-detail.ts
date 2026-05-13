"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useCardDetail(cardId: string | null) {
  const supabase = createClient();

  return useQuery({
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
      return card;
    },
    enabled: !!cardId,
  });
}
