"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClause, updateClause } from "@/lib/actions/legal/clauses";
import { useCurrentSector } from "@/hooks/use-current-sector";
import type { Clause } from "@/hooks/legal/use-clauses";
import { CLAUSE_CATEGORIES } from "@/lib/validations/legal";
import { CLAUSE_CATEGORY_LABELS } from "@/lib/legal/labels";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface ClauseFormDialogProps {
  clause?: Clause;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

interface FormState {
  title: string;
  category: string;
  body: string;
  isApproved: boolean;
}

function initialState(clause?: Clause): FormState {
  return {
    title: clause?.title ?? "",
    category: clause?.category ?? "general",
    body: clause?.body ?? "",
    isApproved: clause?.is_approved ?? false,
  };
}

export function ClauseFormDialog({
  clause,
  open: controlledOpen,
  onOpenChange,
  hideTrigger,
}: ClauseFormDialogProps) {
  const { currentSector } = useCurrentSector();
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const isEdit = !!clause;

  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  // Seeded from props on mount; edit usages pass a record-keyed `key` and
  // create mode resets on close (see handleOpenChange).
  const [form, setForm] = useState<FormState>(() => initialState(clause));

  function handleOpenChange(next: boolean) {
    if (!next && !isEdit) setForm(initialState());
    setOpen(next);
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const result = isEdit
        ? await updateClause(data)
        : await createClause(data);
      return result as { error?: unknown };
    },
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Erro ao salvar clausula"
        );
        return;
      }
      toast.success(isEdit ? "Clausula atualizada" : "Clausula criada");
      queryClient.invalidateQueries({ queryKey: ["legal-clauses"] });
      setOpen(false);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentSector) return;

    mutation.mutate({
      ...(isEdit ? { id: clause.id } : {}),
      sectorId: currentSector.id,
      title: form.title,
      category: form.category,
      body: form.body,
      isApproved: form.isApproved,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger render={<Button size="sm" />}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Clausula
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Clausula" : "Nova Clausula"}
            </DialogTitle>
            <DialogDescription>
              Adicione um modelo de clausula reutilizavel a biblioteca
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="clause-title">Titulo</Label>
              <Input
                id="clause-title"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Ex: Confidencialidade mutua"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select
                value={form.category}
                onValueChange={(v) => update("category", v ?? "general")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLAUSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CLAUSE_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="clause-body">Conteudo</Label>
              <Textarea
                id="clause-body"
                value={form.body}
                onChange={(e) => update("body", e.target.value)}
                placeholder="Texto da clausula"
                className="min-h-32"
                required
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="clause-approved">Clausula aprovada</Label>
              <Switch
                checked={form.isApproved}
                onCheckedChange={(v) => update("isApproved", v)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={mutation.isPending || !form.title || !form.body}
            >
              {mutation.isPending
                ? "Salvando..."
                : isEdit
                  ? "Salvar"
                  : "Criar Clausula"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
