"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import type { Invoice } from "@/hooks/finance/use-invoices";
import { effectiveInvoiceStatus } from "@/lib/finance/invoice-status";
import { INVOICE_STATUS_LABELS } from "./labels";
import {
  buildInvoicePrintHtml,
  type PrintableLineItem,
} from "@/lib/finance/invoice-print";

interface InvoicePrintButtonProps {
  invoice: Invoice;
  sectorName: string;
}

/**
 * Row action that opens a printable / PDF-ready view of an invoice in a new
 * window (audit item I1). The document is built from the invoice and its line
 * items; the user prints or saves it as PDF with the browser.
 */
export function InvoicePrintButton({
  invoice,
  sectorName,
}: InvoicePrintButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("finance_invoice_line_items")
        .select(
          "description, quantity_milli, unit_price_cents, line_total_cents"
        )
        .eq("invoice_id", invoice.id)
        .order("position", { ascending: true });

      if (error) {
        toast.error("Erro ao carregar itens da fatura");
        return;
      }

      const html = buildInvoicePrintHtml(
        invoice,
        (data ?? []) as PrintableLineItem[],
        sectorName,
        INVOICE_STATUS_LABELS[effectiveInvoiceStatus(invoice)]
      );

      const win = window.open("", "_blank", "width=820,height=900");
      if (!win) {
        toast.error("Permita pop-ups para imprimir a fatura");
        return;
      }
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Imprimir fatura"
      disabled={loading}
      onClick={handlePrint}
    >
      <Printer className="size-4" />
    </Button>
  );
}
