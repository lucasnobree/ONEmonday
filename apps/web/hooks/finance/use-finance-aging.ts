"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

/** A raw aging line returned by the `get_finance_aging` RPC. */
export interface AgingLine {
  id: string;
  number?: string;
  party_name: string;
  amount_cents: number;
  due_date: string;
  days_overdue: number;
}

/** Raw shape of the `get_finance_aging` RPC payload. */
export interface AgingPayload {
  as_of: string;
  receivables: AgingLine[];
  payables: AgingLine[];
}

/**
 * AR/AP aging snapshot for a sector as of today, computed server-side by the
 * `get_finance_aging` RPC (which enforces sector access). Bucketing is done
 * client-side by `lib/finance/aging.ts`.
 *
 * The RPC is single-sector by contract (`p_sector_id`), so under the
 * all-sectors scope this hook resolves to `null`.
 */
export function useFinanceAging(scope: SectorScope | undefined) {
  const supabase = createClient();
  const sectorId = scope ? sectorFilterValue(scope) : undefined;

  return useQuery({
    queryKey: ["finance-aging", scope],
    queryFn: async (): Promise<AgingPayload | null> => {
      if (!sectorId) return null;
      const { data, error } = await supabase.rpc("get_finance_aging", {
        p_sector_id: sectorId,
      });
      if (error) throw error;
      return data as AgingPayload;
    },
    enabled: isScopeReady(scope),
  });
}
