"use client";

import { useState } from "react";
import { useCreateBudget } from "@/hooks/finance/use-budgets";
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

/** Current month as "YYYY-MM" for the month <input>. */
const currentMonth = () => new Date().toISOString().slice(0, 7);

interface BudgetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
}

export function BudgetFormDialog({
  open,
  onOpenChange,
  sectorId,
}: BudgetFormDialogProps) {
  const createBudget = useCreateBudget();

  const [category, setCategory] = useState<ExpenseCategory>("software");
  const [month, setMonth] = useState(currentMonth());
  const [amountCents, setAmountCents] = useState<number | null>(null);

  const formKey = String(open);
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setCategory("software");
    setMonth(currentMonth());
    setAmountCents(null);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amountCents == null || amountCents <= 0) {
      toast.error("Informe um valor valido");
      return;
    }

    const result = await createBudget.mutateAsync({
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
          : "Erro ao criar orcamento"
      );
      return;
    }

    toast.success("Orcamento criado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo Orcamento</DialogTitle>
            <DialogDescription>
              Defina um limite planejado por categoria e mes
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ExpenseCategory)}
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
                <Label htmlFor="budget-month">Mes</Label>
                <Input
                  id="budget-month"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="budget-amount">Valor (R$)</Label>
                <MoneyInput
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
            <Button type="submit" disabled={createBudget.isPending}>
              {createBudget.isPending ? "Salvando..." : "Criar Orcamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
