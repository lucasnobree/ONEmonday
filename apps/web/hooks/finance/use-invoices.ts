"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";
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

export function useInvoices(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["finance-invoices", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];

      let query = supabase
        .from("finance_invoices")
        .select(
          `id, sector_id, number, customer_name, description, amount_cents,
           currency, status, issue_date, due_date, paid_at, created_at`
        )
        .eq("is_active", true);

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query.order("issue_date", {
        ascending: false,
      });

      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
    enabled: isScopeReady(scope),
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
