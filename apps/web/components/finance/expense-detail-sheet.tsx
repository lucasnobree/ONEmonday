"use client";

import { useState } from "react";
import type { Expense } from "@/hooks/finance/use-expenses";
import {
  useExpenseReceipts,
  useExpenseReceiptUrl,
} from "@/hooks/finance/use-expense-receipts";
import { ExpenseFormDialog } from "./expense-form-dialog";
import {
  CATEGORY_LABELS,
  EXPENSE_STATUS_LABELS,
  EXPENSE_STATUS_VARIANTS,
} from "./labels";
import { formatCents } from "@/lib/finance/money";
import { formatDateOnly, formatTimestamp } from "@/lib/finance/dates";
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
import { toast } from "sonner";
import { CreditCard, Pencil, FileText, ExternalLink } from "lucide-react";

interface ExpenseDetailSheetProps {
  expense: Expense | null;
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

/** Human-readable file size (KB / MB). */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Read-only expense record view. Closes Finance audit C2/E5: an expense's
 * receipts, approval state and rejection reason were split across a dialog and
 * inline text. This sheet surfaces line metadata, attached receipts and the
 * approval timeline together — mirrors the Legal detail sheets. "Editar"
 * remains a deliberate action.
 */
export function ExpenseDetailSheet({
  expense,
  open,
  onOpenChange,
}: ExpenseDetailSheetProps) {
  const [showEdit, setShowEdit] = useState(false);
  const { data: receipts } = useExpenseReceipts(open ? expense?.id : undefined);
  const openUrl = useExpenseReceiptUrl();

  if (!expense) return null;

  const statusInfo = {
    label: EXPENSE_STATUS_LABELS[expense.status] ?? expense.status,
    variant: EXPENSE_STATUS_VARIANTS[expense.status] ?? "secondary",
  };
  const receiptCount = receipts?.length ?? 0;
  // A paid expense with no receipt is a documentation gap (audit E3).
  const missingReceipt =
    receiptCount === 0 &&
    (expense.status === "paid" || expense.status === "approved");

  const handleOpenReceipt = async (receiptId: string) => {
    const result = await openUrl.mutateAsync(receiptId);
    if (result.error || !result.data) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao abrir comprovante"
      );
      return;
    }
    window.open(result.data, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle>{expense.vendor_name}</SheetTitle>
                <SheetDescription>
                  {CATEGORY_LABELS[expense.category] ?? expense.category}
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              <Badge variant="outline">
                {formatCents(expense.amount_cents, expense.currency)}
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
              <TabsTrigger value="receipts">
                Comprovantes ({receiptCount})
              </TabsTrigger>
              <TabsTrigger value="approval">Aprovação</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Valor"
                  value={formatCents(expense.amount_cents, expense.currency)}
                />
                <Field label="Moeda" value={expense.currency} />
                <Field
                  label="Categoria"
                  value={CATEGORY_LABELS[expense.category] ?? expense.category}
                />
                <Field
                  label="Data da despesa"
                  value={formatDateOnly(expense.expense_date)}
                />
                <Field
                  label="Vencimento"
                  value={
                    expense.due_date ? formatDateOnly(expense.due_date) : "-"
                  }
                />
                <Field
                  label="Pagamento"
                  value={
                    expense.paid_at ? formatTimestamp(expense.paid_at) : "-"
                  }
                />
                <Field
                  label="Registrada em"
                  value={formatTimestamp(expense.created_at)}
                />
              </div>

              {expense.description && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Descrição</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {expense.description}
                    </p>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="receipts" className="mt-4">
              {missingReceipt && (
                <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  Despesa sem comprovante anexado.
                </p>
              )}
              {receiptCount === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum comprovante anexado a esta despesa.
                </p>
              ) : (
                <div className="space-y-2">
                  {(receipts ?? []).map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 border rounded-lg p-2.5"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {r.file_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(r.file_size)} ·{" "}
                          {formatTimestamp(r.created_at)}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Abrir comprovante"
                        disabled={openUrl.isPending}
                        onClick={() => handleOpenReceipt(r.id)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="approval" className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Status atual"
                  value={
                    <Badge variant={statusInfo.variant}>
                      {statusInfo.label}
                    </Badge>
                  }
                />
                <Field
                  label="Aprovada em"
                  value={
                    expense.approved_at
                      ? formatTimestamp(expense.approved_at)
                      : "-"
                  }
                />
              </div>

              {expense.status === "rejected" && expense.rejection_reason && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
                  <p className="text-xs font-medium text-destructive">
                    Motivo da rejeição
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {expense.rejection_reason}
                  </p>
                </div>
              )}

              {expense.status === "pending" && (
                <p className="text-sm text-muted-foreground">
                  Despesa ainda não enviada para aprovação.
                </p>
              )}
              {expense.status === "submitted" && (
                <p className="text-sm text-muted-foreground">
                  Aguardando aprovação de um responsável.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <ExpenseFormDialog
        key={expense.id}
        open={showEdit}
        onOpenChange={setShowEdit}
        sectorId={expense.sector_id}
        expense={expense}
      />
    </>
  );
}
