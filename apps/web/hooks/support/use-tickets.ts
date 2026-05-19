"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

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
  requester_email: string | null;
  status: string;
  resolved_at: string | null;
  first_response_at: string | null;
  escalated_to_sector_id: string | null;
  sla_response_breached: boolean;
  sla_resolve_breached: boolean;
  created_at: string;
  card: TicketCard | null;
}

export function useTickets(scope: SectorScope | undefined) {
  return useQuery<TicketListItem[]>({
    queryKey: ["support-tickets", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];
      const supabase = createClient();

      let query = supabase
        .from("support_tickets")
        .select("*, card:cards(*, card_assignees(user_id, users(full_name)))")
        .eq("is_active", true);

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data } = await query.order("created_at", { ascending: false });
      return (data || []) as unknown as TicketListItem[];
    },
    enabled: isScopeReady(scope),
  });
}
