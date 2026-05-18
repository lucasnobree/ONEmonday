"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  uploadExpenseReceipt,
  deleteExpenseReceipt,
  getExpenseReceiptUrl,
} from "@/lib/actions/finance/receipts";

/** A receipt file attached to an expense. */
export interface ExpenseReceipt {
  id: string;
  expense_id: string;
  sector_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string | null;
  created_at: string;
}

/** Receipts attached to a single expense, newest first. */
export function useExpenseReceipts(expenseId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["finance-expense-receipts", expenseId],
    queryFn: async () => {
      if (!expenseId) return [];
      const { data, error } = await supabase
        .from("finance_expense_receipts")
        .select(
          `id, expense_id, sector_id, file_name, file_path, file_size,
           mime_type, created_at`
        )
        .eq("expense_id", expenseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExpenseReceipt[];
    },
    enabled: !!expenseId,
  });
}

export function useUploadExpenseReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => uploadExpenseReceipt(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["finance-expense-receipts"],
      });
    },
  });
}

export function useDeleteExpenseReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (receiptId: string) => deleteExpenseReceipt(receiptId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["finance-expense-receipts"],
      });
    },
  });
}

/** Fetches a fresh short-lived signed URL for a receipt. */
export function useExpenseReceiptUrl() {
  return useMutation({
    mutationFn: (receiptId: string) => getExpenseReceiptUrl(receiptId),
  });
}
