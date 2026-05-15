"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createContract,
  updateContract,
} from "@/lib/actions/legal/contracts";
import { useCurrentSector } from "@/hooks/use-current-sector";
import type { Contract } from "@/hooks/legal/use-contracts";
import {
  CONTRACT_TYPES,
  CONTRACT_STATUSES,
  RENEWAL_TYPES,
} from "@/lib/validations/legal";
import {
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUS_LABELS,
  RENEWAL_TYPE_LABELS,
} from "@/lib/legal/labels";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface ContractFormDialogProps {
  /** When provided the dialog edits this contract; otherwise it creates one. */
  contract?: Contract;
  /** Controlled open state — used for the edit-from-row flow. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hides the built-in trigger button (for controlled edit usage). */
  hideTrigger?: boolean;
}

interface FormState {
  title: string;
  counterparty: string;
  contractType: string;
  status: string;
  renewalType: string;
  noticePeriodDays: string;
  valueAmount: string;
  currency: string;
  effectiveDate: string;
  expiryDate: string;
  description: string;
}

function initialState(contract?: Contract): FormState {
  return {
    title: contract?.title ?? "",
    counterparty: contract?.counterparty ?? "",
    contractType: contract?.contract_type ?? "service",
    status: contract?.status ?? "draft",
    renewalType: contract?.renewal_type ?? "none",
    noticePeriodDays: String(contract?.notice_period_days ?? 30),
    valueAmount:
      contract?.value_amount != null ? String(contract.value_amount) : "",
    currency: contract?.currency ?? "BRL",
    effectiveDate: contract?.effective_date ?? "",
    expiryDate: contract?.expiry_date ?? "",
    description: contract?.description ?? "",
  };
}

export function ContractFormDialog({
  contract,
  open: controlledOpen,
  onOpenChange,
  hideTrigger,
}: ContractFormDialogProps) {
  const { currentSector } = useCurrentSector();
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const isEdit = !!contract;

  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  // State is seeded from props on mount. Parents that reuse this dialog for
  // editing pass a `key` tied to the record id so React remounts it fresh,
  // and the create-mode dialog resets on close (see handleOpenChange).
  const [form, setForm] = useState<FormState>(() => initialState(contract));

  function handleOpenChange(next: boolean) {
    if (!next && !isEdit) setForm(initialState());
    setOpen(next);
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const result = isEdit
        ? await updateContract(data)
        : await createContract(data);
      return result as { error?: unknown };
    },
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Erro ao salvar contrato"
        );
        return;
      }
      toast.success(isEdit ? "Contrato atualizado" : "Contrato criado");
      queryClient.invalidateQueries({ queryKey: ["legal-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["legal-stats"] });
      setOpen(false);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentSector) return;

    const trimmedValue = form.valueAmount.trim();
    mutation.mutate({
      ...(isEdit ? { id: contract.id } : {}),
      sectorId: currentSector.id,
      title: form.title,
      counterparty: form.counterparty,
      contractType: form.contractType,
      status: form.status,
      renewalType: form.renewalType,
      noticePeriodDays: Number(form.noticePeriodDays) || 0,
      valueAmount: trimmedValue ? Number(trimmedValue) : undefined,
      currency: form.currency,
      effectiveDate: form.effectiveDate,
      expiryDate: form.expiryDate,
      description: form.description,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger render={<Button size="sm" />}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Contrato
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Contrato" : "Novo Contrato"}
            </DialogTitle>
            <DialogDescription>
              Registre os dados do contrato e o ciclo de renovacao
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Titulo</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Ex: Contrato de prestacao de servicos"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="counterparty">Contraparte</Label>
              <Input
                id="counterparty"
                value={form.counterparty}
                onChange={(e) => update("counterparty", e.target.value)}
                placeholder="Ex: Acme Ltda"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select
                  value={form.contractType}
                  onValueChange={(v) => update("contractType", v ?? "service")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {CONTRACT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => update("status", v ?? "draft")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CONTRACT_STATUS_LABELS[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="effectiveDate">Data de inicio</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => update("effectiveDate", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expiryDate">Data de termino</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => update("expiryDate", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Renovacao</Label>
                <Select
                  value={form.renewalType}
                  onValueChange={(v) => update("renewalType", v ?? "none")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RENEWAL_TYPES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {RENEWAL_TYPE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="noticePeriodDays">
                  Aviso previo (dias)
                </Label>
                <Input
                  id="noticePeriodDays"
                  type="number"
                  min={0}
                  value={form.noticePeriodDays}
                  onChange={(e) =>
                    update("noticePeriodDays", e.target.value)
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2 col-span-2">
                <Label htmlFor="valueAmount">Valor</Label>
                <Input
                  id="valueAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.valueAmount}
                  onChange={(e) => update("valueAmount", e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency">Moeda</Label>
                <Input
                  id="currency"
                  value={form.currency}
                  onChange={(e) =>
                    update("currency", e.target.value.toUpperCase())
                  }
                  maxLength={8}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Observacoes</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Notas internas sobre o contrato"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                mutation.isPending || !form.title || !form.counterparty
              }
            >
              {mutation.isPending
                ? "Salvando..."
                : isEdit
                  ? "Salvar"
                  : "Criar Contrato"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
