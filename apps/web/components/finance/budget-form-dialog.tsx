"use client";

import { useState } from "react";
import {
  useCreateBudget,
  useUpdateBudget,
} from "@/hooks/finance/use-budgets";
import type { Budget } from "@/hooks/finance/use-budgets";
import type { ExpenseCategory } from "@/hooks/finance/use-expenses";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MoneyInput } from "./money-input";
import { CATEGORY_LABELS } from "./labels";
import { EXPENSE_CATEGORIES } from "@/lib/validations/finance";
import { currentMonthKey } from "@/lib/finance/dates";

interface BudgetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  /** When set, the dialog edits this budget instead of creating a new one. */
  budget?: Budget;
  /** Month (`YYYY-MM`) to pre-select when creating a new budget. */
  defaultMonth?: string;
}

export function BudgetFormDialog({
  open,
  onOpenChange,
  sectorId,
  budget,
  defaultMonth,
}: BudgetFormDialogProps) {
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const isEdit = !!budget;

  const [category, setCategory] = useState<ExpenseCategory>("software");
  const [month, setMonth] = useState(currentMonthKey());
  const [amountCents, setAmountCents] = useState<number | null>(null);

  // Re-seed the form when the dialog (re)opens — state adjusted during render.
  const formKey = `${open}:${budget?.id ?? "new"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setCategory(budget?.category ?? "software");
    setMonth(
      budget?.period_month.slice(0, 7) ?? defaultMonth ?? currentMonthKey()
    );
    setAmountCents(budget?.amount_cents ?? null);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amountCents == null || amountCents <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    // Editing only changes the planned amount — category and month are fixed
    // because they are part of the (sector, category, month) uniqueness key.
    const result = isEdit
      ? await updateBudget.mutateAsync({ id: budget.id, amountCents })
      : await createBudget.mutateAsync({
          sectorId,
          category,
          periodMonth: `${month}-01`,
          amountCents,
          currency: "BRL" as const,
        });

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : `Erro ao ${isEdit ? "atualizar" : "criar"} orçamento`
      );
      return;
    }

    toast.success(isEdit ? "Orçamento atualizado" : "Orçamento criado");
    onOpenChange(false);
  };

  const isPending = createBudget.isPending || updateBudget.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Orçamento" : "Novo Orçamento"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Atualize o limite planejado deste orçamento"
                : "Defina um limite planejado por categoria e mês"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ExpenseCategory)}
                disabled={isEdit}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="budget-month">Mês</Label>
                <Input
                  id="budget-month"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  disabled={isEdit}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="budget-amount">Valor (R$)</Label>
                <MoneyInput
                  key={formKey}
                  id="budget-amount"
                  valueCents={amountCents}
                  onChangeCents={setAmountCents}
                  required
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Salvando..."
                : isEdit
                  ? "Salvar"
                  : "Criar Orçamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
