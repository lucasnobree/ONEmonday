"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { DrePayload } from "@/lib/finance/dre";

/**
 * Management DRE / P&L for a sector over [from, to] (date-only strings),
 * computed server-side by the `get_finance_dre` RPC (which enforces sector
 * access). The raw payload is shaped into a {@link DreResult} by `buildDre`.
 */
export function useFinanceDre(
  sectorId: string | undefined,
  from: string,
  to: string
) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["finance-dre", sectorId, from, to],
    queryFn: async (): Promise<DrePayload | null> => {
      if (!sectorId) return null;
      const { data, error } = await supabase.rpc("get_finance_dre", {
        p_sector_id: sectorId,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return data as DrePayload;
    },
    enabled: !!sectorId,
  });
}
