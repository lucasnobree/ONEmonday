"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface Contract {
  id: string;
  sector_id: string;
  title: string;
  counterparty: string;
  contract_type: string;
  status: string;
  renewal_type: string;
  notice_period_days: number;
  value_amount: number | null;
  currency: string;
  effective_date: string | null;
  expiry_date: string | null;
  owner_id: string | null;
  description: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useContracts(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["legal-contracts", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("legal_contracts")
        .select("*")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as Contract[]) ?? [];
    },
    enabled: !!sectorId,
  });
}
