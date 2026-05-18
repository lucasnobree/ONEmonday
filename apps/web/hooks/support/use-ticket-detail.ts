"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface TicketDetail {
  id: string;
  card_id: string;
  sector_id: string;
  category: string;
  subcategory: string | null;
  channel: string | null;
  status: string;
  requester_id: string | null;
  requester_email: string | null;
  sla_rule_id: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  sla_paused_at: string | null;
  sla_paused_ms: number;
  sla_response_due_at: string | null;
  sla_resolve_due_at: string | null;
  sla_response_breached: boolean;
  sla_resolve_breached: boolean;
  csat_rating: number | null;
  csat_comment: string | null;
  created_at: string;
  escalated_to_sector_id: string | null;
  escalated_at: string | null;
  escalated_by: string | null;
  escalation_reason: string | null;
  card: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    created_at: string;
    board_columns: { name: string; color: string | null } | null;
    card_assignees: {
      user_id: string;
      users: { full_name: string; email: string } | null;
    }[];
    card_comments: {
      id: string;
      content: string;
      created_at: string;
      user_id: string;
      is_active: boolean;
      users: { full_name: string } | null;
    }[];
    card_activity_log: {
      id: string;
      action: string;
      metadata: Record<string, unknown>;
      created_at: string;
      user_id: string;
      users: { full_name: string } | null;
    }[];
  } | null;
  sla_rules: {
    name: string;
    response_time_hours: number;
    resolve_time_hours: number;
  } | null;
}

export function useTicketDetail(cardId: string | null) {
  return useQuery<TicketDetail | null>({
    queryKey: ["ticket-detail", cardId],
    queryFn: async () => {
      if (!cardId) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("support_tickets")
        .select(
          `
          *,
          card:cards(
            *,
            board_columns(name, color),
            card_assignees(user_id, users(full_name, email)),
            card_comments(id, content, created_at, user_id, is_active, users(full_name)),
            card_activity_log(id, action, metadata, created_at, user_id, users(full_name))
          ),
          sla_rules(name, response_time_hours, resolve_time_hours)
        `
        )
        .eq("card_id", cardId)
        .single();

      if (error || !data) return null;
      return data as unknown as TicketDetail;
    },
    enabled: !!cardId,
  });
}
