"use client";

import { useState } from "react";
import {
  useCreateExpense,
  useUpdateExpense,
} from "@/hooks/finance/use-expenses";
import type {
  Expense,
  ExpenseCategory,
  ExpenseStatus,
} from "@/hooks/finance/use-expenses";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MoneyInput } from "./money-input";
import { CATEGORY_LABELS, EXPENSE_STATUS_LABELS } from "./labels";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
} from "@/lib/validations/finance";
import { todayDateOnly } from "@/lib/finance/dates";

const today = () => todayDateOnly();

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  expense?: Expense;
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  sectorId,
  expense,
}: ExpenseFormDialogProps) {
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const isEdit = !!expense;

  const [vendorName, setVendorName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [status, setStatus] = useState<ExpenseStatus>("pending");
  const [expenseDate, setExpenseDate] = useState(today());

  const formKey = `${open}:${expense?.id ?? "new"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setVendorName(expense?.vendor_name ?? "");
    setDescription(expense?.description ?? "");
    setCategory(expense?.category ?? "other");
    setAmountCents(expense?.amount_cents ?? null);
    setStatus(expense?.status ?? "pending");
    setExpenseDate(expense?.expense_date ?? today());
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amountCents == null || amountCents <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    const payload = isEdit
      ? {
          id: expense.id,
          vendorName,
          description: description || undefined,
          category,
          amountCents,
          currency: expense.currency,
          status,
          expenseDate,
        }
      : {
          sectorId,
          vendorName,
          description: description || undefined,
          category,
          amountCents,
          currency: "BRL" as const,
          status,
          expenseDate,
        };

    const result = isEdit
      ? await updateExpense.mutateAsync(payload)
      : await createExpense.mutateAsync(payload);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : `Erro ao ${isEdit ? "atualizar" : "criar"} despesa`
      );
      return;
    }

    toast.success(isEdit ? "Despesa atualizada" : "Despesa criada");
    onOpenChange(false);
  };

  const isPending = createExpense.isPending || updateExpense.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Despesa" : "Nova Despesa"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Atualize os dados da despesa"
                : "Registre uma nova conta a pagar"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="expense-vendor">Fornecedor</Label>
                <Input
                  id="expense-vendor"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Nome do fornecedor"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expense-amount">Valor (R$)</Label>
                <MoneyInput
                  key={formKey}
                  id="expense-amount"
                  valueCents={amountCents}
                  onChangeCents={setAmountCents}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
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
              <div className="grid gap-2">
                <Label htmlFor="expense-date">Data</Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as ExpenseStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {EXPENSE_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="expense-description">Descrição</Label>
              <Textarea
                id="expense-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes da despesa"
              />
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
            <Button type="submit" disabled={isPending || !vendorName}>
              {isPending
                ? "Salvando..."
                : isEdit
                  ? "Salvar"
                  : "Criar Despesa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
