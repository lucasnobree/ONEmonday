"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/** A persisted invoice line item, as stored in finance_invoice_line_items. */
export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  sector_id: string;
  description: string;
  /** Quantity in integer milli-units (1000 = 1.000). */
  quantity_milli: number;
  unit_price_cents: number;
  line_total_cents: number;
  position: number;
}

/** Line items of a single invoice, ordered by their display position. */
export function useInvoiceLineItems(invoiceId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["finance-invoice-line-items", invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      const { data, error } = await supabase
        .from("finance_invoice_line_items")
        .select(
          `id, invoice_id, sector_id, description, quantity_milli,
           unit_price_cents, line_total_cents, position`
        )
        .eq("invoice_id", invoiceId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as InvoiceLineItem[];
    },
    enabled: !!invoiceId,
  });
}
