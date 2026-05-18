"use client";

import { useState, useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import {
  useExpenses,
  useDeleteExpense,
} from "@/hooks/finance/use-expenses";
import type {
  Expense,
  ExpenseCategory,
  ExpenseStatus,
} from "@/hooks/finance/use-expenses";
import { ExpenseFormDialog } from "@/components/finance/expense-form-dialog";
import { ExpenseReceiptsDialog } from "@/components/finance/expense-receipts-dialog";
import { ExpenseDetailSheet } from "@/components/finance/expense-detail-sheet";
import { ExpenseApprovalMenu } from "@/components/finance/expense-approval-menu";
import {
  CATEGORY_LABELS,
  EXPENSE_STATUS_LABELS,
  EXPENSE_STATUS_VARIANTS,
} from "@/components/finance/labels";
import { formatCents, sumCents } from "@/lib/finance/money";
import { formatDateOnly } from "@/lib/finance/dates";
import { exportToCSV } from "@/lib/utils/export-csv";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
} from "@/lib/validations/finance";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { Plus, Download, Pencil, Trash2, CreditCard, Paperclip } from "lucide-react";

export default function ExpensesPage() {
  const { currentSector } = useCurrentSector();
  const { data: expenses, isLoading } = useExpenses(currentSector?.id);
  const deleteExpense = useDeleteExpense();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>();
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [receiptsExpense, setReceiptsExpense] = useState<Expense | undefined>();
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "all">(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "all">("all");

  // Category and status filters combine (audit item E5).
  const filtered = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter(
      (e) =>
        (categoryFilter === "all" || e.category === categoryFilter) &&
        (statusFilter === "all" || e.status === statusFilter)
    );
  }, [expenses, categoryFilter, statusFilter]);

  // Filtered-set total (audit item E6).
  const filteredTotal = useMemo(
    () => sumCents(filtered.map((e) => e.amount_cents)),
    [filtered]
  );

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar as despesas.
      </p>
    );
  }

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    setDialogOpen(true);
  };

  const openReceipts = (expense: Expense) => {
    setReceiptsExpense(expense);
    setReceiptsOpen(true);
  };

  const handleDelete = async (expense: Expense) => {
    const result = await deleteExpense.mutateAsync(expense.id);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao excluir"
      );
      return;
    }
    toast.success("Despesa excluída");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Despesas</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!filtered.length}
            onClick={() =>
              exportToCSV(
                filtered.map((e) => ({
                  fornecedor: e.vendor_name,
                  categoria: CATEGORY_LABELS[e.category],
                  valor: formatCents(e.amount_cents, e.currency),
                  status: EXPENSE_STATUS_LABELS[e.status],
                  data: e.expense_date,
                })),
                `despesas-${new Date().toISOString().split("T")[0]}`,
                [
                  { key: "fornecedor", label: "Fornecedor" },
                  { key: "categoria", label: "Categoria" },
                  { key: "valor", label: "Valor" },
                  { key: "status", label: "Status" },
                  { key: "data", label: "Data" },
                ]
              )
            }
          >
            <Download className="size-4 mr-1" />
            Exportar
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4 mr-1" />
            Nova Despesa
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div
          role="tablist"
          aria-label="Filtrar despesas por categoria"
          className="inline-flex h-8 flex-wrap items-center rounded-lg bg-muted p-0.75 text-muted-foreground"
        >
          <button
            type="button"
            role="tab"
            aria-selected={categoryFilter === "all"}
            onClick={() => setCategoryFilter("all")}
            className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-medium transition-all ${
              categoryFilter === "all"
                ? "bg-background text-foreground shadow-sm"
                : "hover:text-foreground"
            }`}
          >
            Todas
          </button>
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={categoryFilter === c}
              onClick={() => setCategoryFilter(c)}
              className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-medium transition-all ${
                categoryFilter === c
                  ? "bg-background text-foreground shadow-sm"
                  : "hover:text-foreground"
              }`}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        <div
          role="tablist"
          aria-label="Filtrar despesas por status"
          className="inline-flex h-8 flex-wrap items-center rounded-lg bg-muted p-0.75 text-muted-foreground"
        >
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
            className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-medium transition-all ${
              statusFilter === "all"
                ? "bg-background text-foreground shadow-sm"
                : "hover:text-foreground"
            }`}
          >
            Todos
          </button>
          {EXPENSE_STATUSES.map((s) => (
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
              {EXPENSE_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhuma despesa"
          description="Registre contas a pagar para controlar seus custos."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4 mr-1" />
              Nova Despesa
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
                    <th className="p-3 font-medium">Fornecedor</th>
                    <th className="p-3 font-medium">Categoria</th>
                    <th className="p-3 font-medium">Valor</th>
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((exp) => (
                    <tr
                      key={exp.id}
                      className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setDetailExpense(exp)}
                    >
                      <td className="p-3 font-medium">{exp.vendor_name}</td>
                      <td className="p-3 text-muted-foreground">
                        {CATEGORY_LABELS[exp.category]}
                      </td>
                      <td className="p-3 font-medium">
                        {formatCents(exp.amount_cents, exp.currency)}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatDateOnly(exp.expense_date)}
                      </td>
                      <td className="p-3">
                        <Badge variant={EXPENSE_STATUS_VARIANTS[exp.status]}>
                          {EXPENSE_STATUS_LABELS[exp.status]}
                        </Badge>
                        {exp.status === "rejected" && exp.rejection_reason && (
                          <p
                            className="mt-1 max-w-[16rem] truncate text-xs text-muted-foreground"
                            title={exp.rejection_reason}
                          >
                            {exp.rejection_reason}
                          </p>
                        )}
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <ExpenseApprovalMenu expense={exp} />
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Comprovantes"
                            onClick={() => openReceipts(exp)}
                          >
                            <Paperclip className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Editar despesa"
                            onClick={() => openEdit(exp)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <ConfirmDialog
                            title="Excluir despesa"
                            description={`Tem certeza que deseja excluir a despesa de ${exp.vendor_name}?`}
                            onConfirm={() => handleDelete(exp)}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Excluir despesa"
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </ConfirmDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-medium">
                    <td className="p-3" colSpan={2}>
                      {filtered.length}{" "}
                      {filtered.length === 1 ? "despesa" : "despesas"}
                    </td>
                    <td className="p-3" colSpan={4}>
                      Total: {formatCents(filteredTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <ExpenseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sectorId={currentSector.id}
        expense={editing}
      />

      <ExpenseReceiptsDialog
        open={receiptsOpen}
        onOpenChange={setReceiptsOpen}
        expense={receiptsExpense}
      />

      <ExpenseDetailSheet
        expense={detailExpense}
        open={!!detailExpense}
        onOpenChange={(o) => !o && setDetailExpense(null)}
      />
    </div>
  );
}
