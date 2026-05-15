"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  createInvoice,
  updateInvoice,
  deleteInvoice,
} from "@/lib/actions/finance/invoices";
import type { Currency } from "@/lib/finance/money";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";

export interface Invoice {
  id: string;
  sector_id: string;
  number: string;
  customer_name: string;
  description: string | null;
  amount_cents: number;
  currency: Currency;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  paid_at: string | null;
  created_at: string;
}

export function useInvoices(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["finance-invoices", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("finance_invoices")
        .select(
          `id, sector_id, number, customer_name, description, amount_cents,
           currency, status, issue_date, due_date, paid_at, created_at`
        )
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("issue_date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
    enabled: !!sectorId,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => createInvoice(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => updateInvoice(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) => deleteInvoice(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
    },
  });
}
