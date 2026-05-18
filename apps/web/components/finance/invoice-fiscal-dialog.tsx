"use client";

import { useMemo } from "react";
import type { Invoice } from "@/hooks/finance/use-invoices";
import {
  useFiscalDocuments,
  useEmitFiscalDocument,
} from "@/hooks/finance/use-fiscal-documents";
import {
  usePaymentCharges,
  useCreatePaymentCharge,
} from "@/hooks/finance/use-payment-charges";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { FileText, QrCode, Barcode } from "lucide-react";
import { FISCAL_DOC_STATUS_LABELS, CHARGE_STATUS_LABELS } from "./labels";

/**
 * Per-invoice fiscal-emission and payment-charge controls — Phase 4.
 *
 * Lets a user request NF-e/NFS-e emission (Focus NFe) and a boleto/PIX charge
 * (Asaas) for one invoice, and shows the status of anything already requested.
 *
 * When a gateway is unconfigured the server action runs the adapter in no-op
 * mode and returns a `noop` flag; the dialog surfaces a clear "gateway não
 * configurado" toast instead of pretending the document/charge went through.
 */
export function InvoiceFiscalDialog({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | undefined;
}) {
  const { data: fiscalDocs } = useFiscalDocuments(invoice?.sector_id);
  const { data: charges } = usePaymentCharges(invoice?.sector_id);
  const emitFiscal = useEmitFiscalDocument();
  const createCharge = useCreatePaymentCharge();

  const docsForInvoice = useMemo(
    () => (fiscalDocs ?? []).filter((d) => d.invoice_id === invoice?.id),
    [fiscalDocs, invoice]
  );
  const chargesForInvoice = useMemo(
    () => (charges ?? []).filter((c) => c.invoice_id === invoice?.id),
    [charges, invoice]
  );

  if (!invoice) return null;

  const handleEmit = async (docType: "nfe" | "nfse") => {
    const result = await emitFiscal.mutateAsync({
      invoiceId: invoice.id,
      docType,
    });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao emitir documento fiscal"
      );
      return;
    }
    if (result.noop) {
      toast.warning(result.message ?? "Gateway fiscal não configurado");
    } else {
      toast.success("Emissão fiscal solicitada");
    }
  };

  const handleCharge = async (billingType: "pix" | "boleto") => {
    const result = await createCharge.mutateAsync({
      invoiceId: invoice.id,
      billingType,
    });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao gerar cobrança"
      );
      return;
    }
    if (result.noop) {
      toast.warning(result.message ?? "PSP de pagamentos não configurado");
    } else {
      toast.success("Cobrança gerada");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Fiscal e Cobrança — {invoice.number}</DialogTitle>
          <DialogDescription>
            Emissão de nota fiscal e geração de boleto/PIX via gateways
            certificados. A responsabilidade fiscal permanece da empresa e do
            contador.
          </DialogDescription>
        </DialogHeader>

        {/* Fiscal emission */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Documento fiscal</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={emitFiscal.isPending}
              onClick={() => handleEmit("nfse")}
            >
              <FileText className="size-4 mr-1" />
              Emitir NFS-e
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={emitFiscal.isPending}
              onClick={() => handleEmit("nfe")}
            >
              <FileText className="size-4 mr-1" />
              Emitir NF-e
            </Button>
          </div>
          {docsForInvoice.length > 0 && (
            <ul className="space-y-1 text-sm">
              {docsForInvoice.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-muted-foreground">
                    {d.doc_type.toUpperCase()}
                    {d.protocol ? ` · ${d.protocol}` : ""}
                  </span>
                  <Badge
                    variant={
                      d.status === "authorized"
                        ? "default"
                        : d.status === "rejected" || d.status === "error"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {FISCAL_DOC_STATUS_LABELS[d.status] ?? d.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Separator />

        {/* Payment charge */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Cobrança</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={createCharge.isPending}
              onClick={() => handleCharge("pix")}
            >
              <QrCode className="size-4 mr-1" />
              Gerar PIX
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={createCharge.isPending}
              onClick={() => handleCharge("boleto")}
            >
              <Barcode className="size-4 mr-1" />
              Gerar Boleto
            </Button>
          </div>
          {chargesForInvoice.length > 0 && (
            <ul className="space-y-1 text-sm">
              {chargesForInvoice.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-muted-foreground">
                    {c.billing_type.toUpperCase()}
                  </span>
                  <Badge
                    variant={
                      c.status === "received"
                        ? "default"
                        : c.status === "error"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {CHARGE_STATUS_LABELS[c.status] ?? c.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
