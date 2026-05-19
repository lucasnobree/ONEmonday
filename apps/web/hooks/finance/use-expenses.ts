"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";
import {
  createExpense,
  updateExpense,
  deleteExpense,
} from "@/lib/actions/finance/expenses";
import { transitionExpense } from "@/lib/actions/finance/expense-approval";
import type { Currency } from "@/lib/finance/money";
import type { EXPENSE_CATEGORIES } from "@/lib/validations/finance";
import type { ExpenseStatus as WorkflowExpenseStatus } from "@/lib/finance/expense-approval";

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
/** Expense status — includes the approval-workflow states (migration 00140). */
export type ExpenseStatus = WorkflowExpenseStatus;

export interface Expense {
  id: string;
  sector_id: string;
  vendor_name: string;
  description: string | null;
  category: ExpenseCategory;
  amount_cents: number;
  currency: Currency;
  status: ExpenseStatus;
  expense_date: string;
  due_date: string | null;
  paid_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export function useExpenses(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["finance-expenses", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];

      let query = supabase
        .from("finance_expenses")
        .select(
          `id, sector_id, vendor_name, description, category, amount_cents,
           currency, status, expense_date, due_date, paid_at, approved_by,
           approved_at, rejection_reason, created_at`
        )
        .eq("is_active", true);

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query.order("expense_date", {
        ascending: false,
      });

      if (error) throw error;
      return (data ?? []) as Expense[];
    },
    enabled: isScopeReady(scope),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => createExpense(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => updateExpense(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => deleteExpense(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
    },
  });
}

/** Applies an approval-workflow transition (submit / approve / reject / …). */
export function useTransitionExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => transitionExpense(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
    },
  });
}
