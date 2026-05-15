"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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
 */
export function useFinanceSummary(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["finance-summary", sectorId],
    queryFn: async (): Promise<FinanceSummary | null> => {
      if (!sectorId) return null;

      const { data, error } = await supabase.rpc("get_finance_summary", {
        p_sector_id: sectorId,
      });

      if (error) throw error;
      return data as FinanceSummary;
    },
    enabled: !!sectorId,
  });
}
