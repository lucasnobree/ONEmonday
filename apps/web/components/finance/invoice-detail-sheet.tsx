"use client";

import { useMemo, useState } from "react";
import type { Invoice } from "@/hooks/finance/use-invoices";
import { useInvoiceLineItems } from "@/hooks/finance/use-invoice-line-items";
import { useFiscalDocuments } from "@/hooks/finance/use-fiscal-documents";
import { usePaymentCharges } from "@/hooks/finance/use-payment-charges";
import { InvoiceFormDialog } from "./invoice-form-dialog";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_VARIANTS,
  FISCAL_DOC_STATUS_LABELS,
  CHARGE_STATUS_LABELS,
} from "./labels";
import { formatCents, type Currency } from "@/lib/finance/money";
import { formatQuantity } from "@/lib/finance/line-items";
import { formatDateOnly, formatTimestamp } from "@/lib/finance/dates";
import { effectiveInvoiceStatus } from "@/lib/finance/invoice-status";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Receipt, Pencil } from "lucide-react";

interface InvoiceDetailSheetProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** A labelled read-only field row. */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

/**
 * Read-only invoice record view. Closes Finance audit C2/I3: an invoice's line
 * items, fiscal documents and payment charges were only reachable through
 * stacked dialogs. This sheet surfaces them together — mirrors the Legal
 * `ContractDetailSheet`. "Editar" remains a deliberate action.
 */
export function InvoiceDetailSheet({
  invoice,
  open,
  onOpenChange,
}: InvoiceDetailSheetProps) {
  const [showEdit, setShowEdit] = useState(false);

  const { data: lineItems } = useInvoiceLineItems(invoice?.id);
  const { data: fiscalDocs } = useFiscalDocuments(invoice?.sector_id);
  const { data: charges } = usePaymentCharges(invoice?.sector_id);

  const docsForInvoice = useMemo(
    () => (fiscalDocs ?? []).filter((d) => d.invoice_id === invoice?.id),
    [fiscalDocs, invoice]
  );
  const chargesForInvoice = useMemo(
    () => (charges ?? []).filter((c) => c.invoice_id === invoice?.id),
    [charges, invoice]
  );

  if (!invoice) return null;

  const effectiveStatus = effectiveInvoiceStatus(invoice);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle>Fatura {invoice.number}</SheetTitle>
                <SheetDescription>{invoice.customer_name}</SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Badge variant={INVOICE_STATUS_VARIANTS[effectiveStatus]}>
                {INVOICE_STATUS_LABELS[effectiveStatus]}
              </Badge>
              <Badge variant="outline">
                {formatCents(invoice.amount_cents, invoice.currency)}
              </Badge>
            </div>
            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEdit(true)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
            </div>
          </SheetHeader>

          <Tabs defaultValue="info" className="px-4">
            <TabsList variant="line" className="w-full justify-start">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="items">
                Itens ({lineItems?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="fiscal">
                Fiscal ({docsForInvoice.length})
              </TabsTrigger>
              <TabsTrigger value="charges">
                Cobrança ({chargesForInvoice.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Valor"
                  value={formatCents(invoice.amount_cents, invoice.currency)}
                />
                <Field label="Moeda" value={invoice.currency} />
                <Field
                  label="Emissão"
                  value={formatDateOnly(invoice.issue_date)}
                />
                <Field
                  label="Vencimento"
                  value={formatDateOnly(invoice.due_date)}
                />
                <Field
                  label="Pagamento"
                  value={
                    invoice.paid_at ? formatTimestamp(invoice.paid_at) : "-"
                  }
                />
                <Field
                  label="Registrada em"
                  value={formatTimestamp(invoice.created_at)}
                />
              </div>

              {invoice.description && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Descrição</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {invoice.description}
                    </p>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="items" className="mt-4">
              {(lineItems ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum item detalhado nesta fatura.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Descrição</th>
                      <th className="pb-2 font-medium text-right">Qtd.</th>
                      <th className="pb-2 font-medium text-right">
                        Preço unit.
                      </th>
                      <th className="pb-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(lineItems ?? []).map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-2">{item.description}</td>
                        <td className="py-2 text-right">
                          {formatQuantity(item.quantity_milli)}
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          {formatCents(item.unit_price_cents, invoice.currency)}
                        </td>
                        <td className="py-2 text-right font-medium">
                          {formatCents(item.line_total_cents, invoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TabsContent>

            <TabsContent value="fiscal" className="mt-4">
              {docsForInvoice.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum documento fiscal emitido para esta fatura.
                </p>
              ) : (
                <div className="space-y-2">
                  {docsForInvoice.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-2 border rounded-lg p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {d.doc_type.toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {d.protocol
                            ? `Protocolo ${d.protocol}`
                            : formatTimestamp(d.created_at)}
                        </p>
                      </div>
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
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="charges" className="mt-4">
              {chargesForInvoice.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma cobrança gerada para esta fatura.
                </p>
              ) : (
                <div className="space-y-2">
                  {chargesForInvoice.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 border rounded-lg p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {c.billing_type.toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCents(c.amount_cents, c.currency as Currency)}{" "}
                          ·{" "}
                          {formatDateOnly(c.due_date)}
                        </p>
                      </div>
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
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <InvoiceFormDialog
        key={invoice.id}
        open={showEdit}
        onOpenChange={setShowEdit}
        sectorId={invoice.sector_id}
        invoice={invoice}
      />
    </>
  );
}
