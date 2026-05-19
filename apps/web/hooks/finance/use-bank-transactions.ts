"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";
import {
  importOfxStatement,
  reconcileTransaction,
  unreconcileTransaction,
} from "@/lib/actions/finance/reconciliation";

export type MatchStatus = "unmatched" | "matched" | "ignored";

export interface BankTransactionRow {
  id: string;
  sector_id: string;
  source: "ofx" | "pluggy" | "manual";
  external_id: string;
  direction: "credit" | "debit";
  amount_cents: number;
  currency: string;
  posted_date: string;
  description: string | null;
  account_label: string | null;
  match_status: MatchStatus;
  matched_invoice_id: string | null;
  matched_expense_id: string | null;
  created_at: string;
}

/** All bank transactions in scope, newest posted date first. */
export function useBankTransactions(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["finance-bank-transactions", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];
      let query = supabase
        .from("finance_bank_transactions")
        .select(
          `id, sector_id, source, external_id, direction, amount_cents,
           currency, posted_date, description, account_label, match_status,
           matched_invoice_id, matched_expense_id, created_at`
        )
        .eq("is_active", true)
        .order("posted_date", { ascending: false });

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as BankTransactionRow[];
    },
    enabled: isScopeReady(scope),
  });
}

export function useImportOfx() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => importOfxStatement(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["finance-bank-transactions"],
      });
    },
  });
}

export function useReconcileTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => reconcileTransaction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["finance-bank-transactions"],
      });
    },
  });
}

export function useUnreconcileTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId: string) =>
      unreconcileTransaction(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["finance-bank-transactions"],
      });
    },
  });
}
