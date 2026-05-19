"use client";

import { useState, useMemo } from "react";
import { useSectorScope } from "@/hooks/use-sector-scope";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { SectorScopeFilter } from "@/components/shared/sector-scope-filter";
import { sectorFilterValue } from "@/lib/navigation/scoped-query";
import {
  useInvoices,
  useDeleteInvoice,
} from "@/hooks/finance/use-invoices";
import type { Invoice, InvoiceStatus } from "@/hooks/finance/use-invoices";
import { InvoiceFormDialog } from "@/components/finance/invoice-form-dialog";
import { InvoiceFiscalDialog } from "@/components/finance/invoice-fiscal-dialog";
import { InvoiceDetailSheet } from "@/components/finance/invoice-detail-sheet";
import { InvoicePrintButton } from "@/components/finance/invoice-print-button";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_VARIANTS,
} from "@/components/finance/labels";
import { formatCents } from "@/lib/finance/money";
import { formatDateOnly } from "@/lib/finance/dates";
import { effectiveInvoiceStatus } from "@/lib/finance/invoice-status";
import { exportToCSV } from "@/lib/utils/export-csv";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { Plus, Download, Pencil, Trash2, Receipt, FileText } from "lucide-react";

const STATUS_TABS: (InvoiceStatus | "all")[] = [
  "all",
  "draft",
  "sent",
  "paid",
  "overdue",
  "void",
];

export default function InvoicesPage() {
  const { scope, isLoading: scopeLoading } = useSectorScope();
  const { currentSector } = useCurrentSector();
  const { data: invoices, isLoading: invoicesLoading } = useInvoices(scope);
  const isLoading = scopeLoading || invoicesLoading;
  const deleteInvoice = useDeleteInvoice();
  // Creating an invoice needs a concrete target sector.
  const createSectorId = sectorFilterValue(scope) ?? currentSector?.id ?? null;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | undefined>();
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [fiscalDialogOpen, setFiscalDialogOpen] = useState(false);
  const [fiscalInvoice, setFiscalInvoice] = useState<Invoice | undefined>();
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);

  // Each row carries an `effectiveStatus`: a `sent` invoice past its due date
  // is shown (and filtered) as `overdue` even though the stored status lags.
  const rows = useMemo(() => {
    return (invoices ?? []).map((invoice) => ({
      invoice,
      effectiveStatus: effectiveInvoiceStatus(invoice),
    }));
  }, [invoices]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => r.effectiveStatus === statusFilter);
  }, [rows, statusFilter]);

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  const openEdit = (invoice: Invoice) => {
    setEditing(invoice);
    setDialogOpen(true);
  };

  const openFiscal = (invoice: Invoice) => {
    setFiscalInvoice(invoice);
    setFiscalDialogOpen(true);
  };

  const handleDelete = async (invoice: Invoice) => {
    const result = await deleteInvoice.mutateAsync(invoice.id);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao excluir"
      );
      return;
    }
    toast.success("Fatura excluída");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Faturas</h2>
          <SectorScopeFilter />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!filtered.length}
            onClick={() =>
              exportToCSV(
                filtered.map(({ invoice: i, effectiveStatus }) => ({
                  numero: i.number,
                  cliente: i.customer_name,
                  valor: formatCents(i.amount_cents, i.currency),
                  status: INVOICE_STATUS_LABELS[effectiveStatus],
                  emissao: i.issue_date,
                  vencimento: i.due_date,
                })),
                `faturas-${new Date().toISOString().split("T")[0]}`,
                [
                  { key: "numero", label: "Número" },
                  { key: "cliente", label: "Cliente" },
                  { key: "valor", label: "Valor" },
                  { key: "status", label: "Status" },
                  { key: "emissao", label: "Emissão" },
                  { key: "vencimento", label: "Vencimento" },
                ]
              )
            }
          >
            <Download className="size-4 mr-1" />
            Exportar
          </Button>
          <Button size="sm" onClick={openCreate} disabled={!createSectorId}>
            <Plus className="size-4 mr-1" />
            Nova Fatura
          </Button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Filtrar faturas por status"
        className="inline-flex h-8 items-center rounded-lg bg-muted p-0.75 text-muted-foreground"
      >
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={statusFilter === s}
            onClick={() => setStatusFilter(s)}
            className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-medium transition-all ${
              statusFilter === s
                ? "bg-background text-foreground shadow-sm"
                : "hover:text-foreground"
            }`}
          >
            {s === "all" ? "Todas" : INVOICE_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma fatura"
          description="Registre contas a receber para acompanhar seu faturamento."
          action={
            <Button onClick={openCreate} disabled={!createSectorId}>
              <Plus className="size-4 mr-1" />
              Nova Fatura
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3 font-medium">Número</th>
                    <th className="p-3 font-medium">Cliente</th>
                    <th className="p-3 font-medium">Valor</th>
                    <th className="p-3 font-medium">Vencimento</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ invoice: inv, effectiveStatus }) => (
                    <tr
                      key={inv.id}
                      className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setDetailInvoice(inv)}
                    >
                      <td className="p-3 font-medium">{inv.number}</td>
                      <td className="p-3 text-muted-foreground">
                        {inv.customer_name}
                      </td>
                      <td className="p-3 font-medium">
                        {formatCents(inv.amount_cents, inv.currency)}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatDateOnly(inv.due_date)}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={INVOICE_STATUS_VARIANTS[effectiveStatus]}
                        >
                          {INVOICE_STATUS_LABELS[effectiveStatus]}
                        </Badge>
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <InvoicePrintButton
                            invoice={inv}
                            sectorName={currentSector?.name ?? ""}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Fiscal e cobrança"
                            onClick={() => openFiscal(inv)}
                          >
                            <FileText className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Editar fatura"
                            onClick={() => openEdit(inv)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <ConfirmDialog
                            title="Excluir fatura"
                            description={`Tem certeza que deseja excluir a fatura ${inv.number}?`}
                            onConfirm={() => handleDelete(inv)}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Excluir fatura"
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </ConfirmDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {createSectorId && (
        <InvoiceFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          sectorId={createSectorId}
          invoice={editing}
        />
      )}

      <InvoiceFiscalDialog
        open={fiscalDialogOpen}
        onOpenChange={setFiscalDialogOpen}
        invoice={fiscalInvoice}
      />

      <InvoiceDetailSheet
        invoice={detailInvoice}
        open={!!detailInvoice}
        onOpenChange={(o) => !o && setDetailInvoice(null)}
      />
    </div>
  );
}
