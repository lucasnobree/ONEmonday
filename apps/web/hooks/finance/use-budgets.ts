"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";
import {
  createBudget,
  updateBudget,
  deleteBudget,
} from "@/lib/actions/finance/budgets";
import type { Currency } from "@/lib/finance/money";
import type { ExpenseCategory } from "./use-expenses";

export interface Budget {
  id: string;
  sector_id: string;
  category: ExpenseCategory;
  period_month: string;
  amount_cents: number;
  currency: Currency;
  created_at: string;
}

export function useBudgets(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["finance-budgets", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];

      let query = supabase
        .from("finance_budgets")
        .select(
          `id, sector_id, category, period_month, amount_cents, currency, created_at`
        )
        .eq("is_active", true)
        .order("period_month", { ascending: false });

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []) as Budget[];
    },
    enabled: isScopeReady(scope),
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => createBudget(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-budgets"] });
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => updateBudget(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-budgets"] });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (budgetId: string) => deleteBudget(budgetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-budgets"] });
    },
  });
}
