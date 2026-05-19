"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { isScopeReady, rpcSectorParam } from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

export interface CashFlowPoint {
  month: string;
  income_cents: number;
  expense_cents: number;
}

export interface FinanceSummary {
  total_income_cents: number;
  total_expense_cents: number;
  outstanding_ar_cents: number;
  outstanding_ap_cents: number;
  overdue_invoice_count: number;
  cash_flow: CashFlowPoint[];
}

/**
 * Cash-flow KPIs and the 6-month inflow/outflow series, computed server-side
 * by the `get_finance_summary` RPC (which enforces sector access).
 *
 * The RPC accepts a nullable `p_sector_id`: under the all-sectors scope this
 * hook passes `null` and the RPC returns a cross-sector aggregate (admin-only,
 * enforced server-side).
 */
export function useFinanceSummary(scope: SectorScope | undefined) {
  const supabase = createClient();
  const sectorParam = rpcSectorParam(scope);

  return useQuery({
    queryKey: ["finance-summary", scope],
    queryFn: async (): Promise<FinanceSummary | null> => {
      if (sectorParam === undefined) return null;

      const { data, error } = await supabase.rpc("get_finance_summary", {
        p_sector_id: sectorParam,
      });

      if (error) throw error;
      return data as FinanceSummary;
    },
    enabled: isScopeReady(scope),
  });
}
