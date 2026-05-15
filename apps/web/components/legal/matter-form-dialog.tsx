"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createMatter, updateMatter } from "@/lib/actions/legal/matters";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useContracts } from "@/hooks/legal/use-contracts";
import type { Matter } from "@/hooks/legal/use-matters";
import {
  MATTER_TYPES,
  MATTER_PRIORITIES,
  MATTER_STATUSES,
} from "@/lib/validations/legal";
import {
  MATTER_TYPE_LABELS,
  MATTER_PRIORITY_LABELS,
  MATTER_STATUS_LABELS,
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

interface MatterFormDialogProps {
  matter?: Matter;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

interface FormState {
  title: string;
  matterType: string;
  priority: string;
  status: string;
  contractId: string;
  dueDate: string;
  description: string;
}

const NO_CONTRACT = "__none__";

function initialState(matter?: Matter): FormState {
  return {
    title: matter?.title ?? "",
    matterType: matter?.matter_type ?? "contract_review",
    priority: matter?.priority ?? "medium",
    status: matter?.status ?? "open",
    contractId: matter?.contract_id ?? NO_CONTRACT,
    dueDate: matter?.due_date ?? "",
    description: matter?.description ?? "",
  };
}

export function MatterFormDialog({
  matter,
  open: controlledOpen,
  onOpenChange,
  hideTrigger,
}: MatterFormDialogProps) {
  const { currentSector } = useCurrentSector();
  const { data: contracts } = useContracts(currentSector?.id);
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const isEdit = !!matter;

  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  // Seeded from props on mount; edit usages pass a record-keyed `key` and
  // create mode resets on close (see handleOpenChange).
  const [form, setForm] = useState<FormState>(() => initialState(matter));

  function handleOpenChange(next: boolean) {
    if (!next && !isEdit) setForm(initialState());
    setOpen(next);
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const result = isEdit
        ? await updateMatter(data)
        : await createMatter(data);
      return result as { error?: unknown };
    },
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Erro ao salvar demanda"
        );
        return;
      }
      toast.success(isEdit ? "Demanda atualizada" : "Demanda criada");
      queryClient.invalidateQueries({ queryKey: ["legal-matters"] });
      queryClient.invalidateQueries({ queryKey: ["legal-stats"] });
      setOpen(false);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentSector) return;

    mutation.mutate({
      ...(isEdit ? { id: matter.id } : {}),
      sectorId: currentSector.id,
      title: form.title,
      matterType: form.matterType,
      priority: form.priority,
      status: form.status,
      contractId:
        form.contractId === NO_CONTRACT ? undefined : form.contractId,
      dueDate: form.dueDate,
      description: form.description,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger render={<Button size="sm" />}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Demanda
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Demanda" : "Nova Demanda Juridica"}
            </DialogTitle>
            <DialogDescription>
              Registre uma solicitacao para o time juridico
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="matter-title">Titulo</Label>
              <Input
                id="matter-title"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Ex: Revisar contrato de fornecedor"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select
                  value={form.matterType}
                  onValueChange={(v) =>
                    update("matterType", v ?? "contract_review")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATTER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {MATTER_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Prioridade</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => update("priority", v ?? "medium")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATTER_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {MATTER_PRIORITY_LABELS[p].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => update("status", v ?? "open")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATTER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {MATTER_STATUS_LABELS[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="matter-due">Prazo</Label>
                <Input
                  id="matter-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => update("dueDate", e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Contrato relacionado</Label>
              <Select
                value={form.contractId}
                onValueChange={(v) => update("contractId", v ?? NO_CONTRACT)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CONTRACT}>Nenhum</SelectItem>
                  {(contracts ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="matter-desc">Descricao</Label>
              <Textarea
                id="matter-desc"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Detalhe a demanda"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={mutation.isPending || !form.title}
            >
              {mutation.isPending
                ? "Salvando..."
                : isEdit
                  ? "Salvar"
                  : "Criar Demanda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
