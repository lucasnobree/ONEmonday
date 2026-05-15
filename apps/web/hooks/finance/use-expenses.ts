"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createExpense,
  updateExpense,
  deleteExpense,
} from "@/lib/actions/finance/expenses";
import type { Currency } from "@/lib/finance/money";
import type { EXPENSE_CATEGORIES } from "@/lib/validations/finance";

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseStatus = "pending" | "paid" | "void";

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
  paid_at: string | null;
  created_at: string;
}

export function useExpenses(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["finance-expenses", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("finance_expenses")
        .select(
          `id, sector_id, vendor_name, description, category, amount_cents,
           currency, status, expense_date, paid_at, created_at`
        )
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("expense_date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Expense[];
    },
    enabled: !!sectorId,
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
