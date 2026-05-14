"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface DealDetail {
  id: string;
  card_id: string;
  sector_id: string;
  value: number | null;
  currency: string;
  expected_close_date: string | null;
  actual_close_date: string | null;
  win_probability: number | null;
  lost_reason: string | null;
  source: string | null;
  created_at: string;
  card: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    due_date: string | null;
    created_at: string;
    column: { name: string; color: string };
    assignees: { user_id: string; user: { full_name: string; email: string } }[];
  };
  company: { id: string; name: string; domain: string | null; industry: string | null } | null;
  contact: { id: string; full_name: string; email: string | null; phone: string | null; position: string | null } | null;
  proposals: {
    id: string;
    title: string;
    value: number;
    status: string;
    sent_at: string | null;
    expires_at: string | null;
  }[];
}

export function useDealDetail(dealId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["crm-deal-detail", dealId],
    queryFn: async () => {
      if (!dealId) return null;

      const { data, error } = await supabase
        .from("crm_deals")
        .select(
          `
          id, card_id, sector_id, value, currency,
          expected_close_date, actual_close_date,
          win_probability, lost_reason, source, created_at,
          cards!inner (
            id, title, description, priority, due_date, created_at,
            board_columns (name, color),
            card_assignees (user_id, users (full_name, email))
          ),
          crm_companies (id, name, domain, industry),
          crm_contacts (id, full_name, email, phone, position),
          crm_proposals (id, title, value, status, sent_at, expires_at)
        `
        )
        .eq("id", dealId)
        .single();

      if (error) throw error;

      const cards = data.cards as any;
      return {
        ...data,
        card: {
          ...cards,
          column: cards.board_columns,
          assignees: (cards.card_assignees || []).map((a: any) => ({
            user_id: a.user_id,
            user: a.users,
          })),
        },
        company: data.crm_companies,
        contact: data.crm_contacts,
        proposals: data.crm_proposals || [],
      } as unknown as DealDetail;
    },
    enabled: !!dealId,
  });
}
