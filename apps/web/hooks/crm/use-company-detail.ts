"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface CompanyDetail {
  id: string;
  sector_id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  created_at: string;
  contacts: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    position: string | null;
    is_primary: boolean;
  }[];
  deals: {
    id: string;
    value: number | null;
    win_probability: number | null;
    expected_close_date: string | null;
    actual_close_date: string | null;
    lost_reason: string | null;
    card: { title: string; priority: string };
    column: { name: string; color: string };
  }[];
}

export function useCompanyDetail(companyId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["crm-company-detail", companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const { data, error } = await supabase
        .from("crm_companies")
        .select(
          `
          id, sector_id, name, domain, industry, size,
          phone, email, address, city, state, notes, created_at,
          crm_contacts (id, full_name, email, phone, position, is_primary),
          crm_deals (
            id, value, win_probability, expected_close_date,
            actual_close_date, lost_reason,
            cards (title, priority, board_columns (name, color))
          )
        `
        )
        .eq("id", companyId)
        .single();

      if (error) throw error;

      return {
        ...data,
        contacts: data.crm_contacts || [],
        deals: (data.crm_deals || []).map((d: any) => ({
          ...d,
          card: d.cards,
          column: d.cards?.board_columns,
        })),
      } as CompanyDetail;
    },
    enabled: !!companyId,
  });
}
