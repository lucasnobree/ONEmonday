"use client";

import { useState, useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useBudgets, useDeleteBudget } from "@/hooks/finance/use-budgets";
import { useExpenses } from "@/hooks/finance/use-expenses";
import type { Budget } from "@/hooks/finance/use-budgets";
import { BudgetFormDialog } from "@/components/finance/budget-form-dialog";
import { CATEGORY_LABELS } from "@/components/finance/labels";
import {
  formatCents,
  fromCents,
  budgetUsagePercent,
  sumCents,
} from "@/lib/finance/money";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { Plus, Trash2, PiggyBank } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

/** Current month key as "YYYY-MM". */
const currentMonthKey = () => new Date().toISOString().slice(0, 7);

export default function BudgetsPage() {
  const { currentSector } = useCurrentSector();
  const { data: budgets, isLoading: budgetsLoading } = useBudgets(
    currentSector?.id
  );
  const { data: expenses, isLoading: expensesLoading } = useExpenses(
    currentSector?.id
  );
  const deleteBudget = useDeleteBudget();

  const [dialogOpen, setDialogOpen] = useState(false);
  const monthKey = currentMonthKey();

  // Actual paid spend per category for the current month, in integer cents.
  const actualByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses ?? []) {
      if (e.status !== "paid") continue;
      if (e.expense_date.slice(0, 7) !== monthKey) continue;
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount_cents);
    }
    return map;
  }, [expenses, monthKey]);

  // Budgets for the current month, joined with actual spend.
  const rows = useMemo(() => {
    return (budgets ?? [])
      .filter((b) => b.period_month.slice(0, 7) === monthKey)
      .map((b) => {
        const actualCents = actualByCategory.get(b.category) ?? 0;
        return {
          budget: b,
          actualCents,
          usagePercent: budgetUsagePercent(actualCents, b.amount_cents),
        };
      });
  }, [budgets, actualByCategory, monthKey]);

  const totals = useMemo(() => {
    const planned = sumCents(rows.map((r) => r.budget.amount_cents));
    const actual = sumCents(rows.map((r) => r.actualCents));
    return { planned, actual };
  }, [rows]);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar os orcamentos.
      </p>
    );
  }

  const isLoading = budgetsLoading || expensesLoading;

  const handleDelete = async (budget: Budget) => {
    const result = await deleteBudget.mutateAsync(budget.id);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao excluir"
      );
      return;
    }
    toast.success("Orcamento excluido");
  };

  const chartData = rows.map((r) => ({
    categoria: CATEGORY_LABELS[r.budget.category],
    Orcado: fromCents(r.budget.amount_cents),
    Realizado: fromCents(r.actualCents),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Orcamentos</h2>
          <p className="text-xs text-muted-foreground">
            Orcado vs. realizado do mes corrente
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4 mr-1" />
          Novo Orcamento
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Nenhum orcamento neste mes"
          description="Defina limites de gasto por categoria para acompanhar o realizado."
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4 mr-1" />
              Novo Orcamento
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Orcado</p>
                <p className="text-xl font-bold">
                  {formatCents(totals.planned)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Realizado</p>
                <p className="text-xl font-bold">
                  {formatCents(totals.actual)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Saldo</p>
                <p
                  className={`text-xl font-bold ${
                    totals.planned - totals.actual >= 0
                      ? "text-emerald-500"
                      : "text-red-500"
                  }`}
                >
                  {formatCents(totals.planned - totals.actual)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Orcado vs. Realizado
              </CardTitle>
              <CardDescription>Por categoria, no mes corrente</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis dataKey="categoria" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) =>
                      new Intl.NumberFormat("pt-BR", {
                        notation: "compact",
                      }).format(v)
                    }
                  />
                  <Tooltip
                    formatter={(value) =>
                      formatCents(Math.round(Number(value) * 100))
                    }
                  />
                  <Legend />
                  <Bar dataKey="Orcado" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="Realizado"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {rows.map((r) => {
                  const over = r.usagePercent > 100;
                  return (
                    <div
                      key={r.budget.id}
                      className="flex items-center gap-4 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">
                            {CATEGORY_LABELS[r.budget.category]}
                          </p>
                          <p
                            className={`text-xs font-medium ${
                              over ? "text-red-500" : "text-muted-foreground"
                            }`}
                          >
                            {formatCents(r.actualCents)} /{" "}
                            {formatCents(r.budget.amount_cents)}
                          </p>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full ${
                              over ? "bg-red-500" : "bg-primary"
                            }`}
                            style={{
                              width: `${Math.min(r.usagePercent, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span
                        className={`w-12 shrink-0 text-right text-xs font-semibold ${
                          over ? "text-red-500" : "text-muted-foreground"
                        }`}
                      >
                        {r.usagePercent}%
                      </span>
                      <ConfirmDialog
                        title="Excluir orcamento"
                        description={`Excluir o orcamento de ${CATEGORY_LABELS[r.budget.category]}?`}
                        onConfirm={() => handleDelete(r.budget)}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Excluir orcamento"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </ConfirmDialog>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <BudgetFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sectorId={currentSector.id}
      />
    </div>
  );
}
