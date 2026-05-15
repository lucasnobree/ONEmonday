"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface TicketAssignee {
  user_id: string;
  users: { full_name: string } | null;
}

export interface TicketCard {
  id: string;
  title: string | null;
  description: string | null;
  priority: string | null;
  card_assignees: TicketAssignee[];
}

export interface TicketListItem {
  id: string;
  card_id: string;
  sector_id: string;
  category: string | null;
  subcategory: string | null;
  channel: string | null;
  resolved_at: string | null;
  first_response_at: string | null;
  escalated_to_sector_id: string | null;
  sla_response_breached: boolean;
  sla_resolve_breached: boolean;
  created_at: string;
  card: TicketCard | null;
}

export function useTickets(sectorId: string | undefined) {
  return useQuery<TicketListItem[]>({
    queryKey: ["support-tickets", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("support_tickets")
        .select(
          "*, card:cards(*, card_assignees(user_id, users(full_name)))"
        )
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return (data || []) as unknown as TicketListItem[];
    },
    enabled: !!sectorId,
  });
}
