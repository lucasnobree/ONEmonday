"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

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

export function useContracts(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["legal-contracts", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];

      let query = supabase
        .from("legal_contracts")
        .select("*")
        .eq("is_active", true);

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;
      return (data as Contract[]) ?? [];
    },
    enabled: isScopeReady(scope),
  });
}
