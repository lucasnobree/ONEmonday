"use client";

import { useState } from "react";
import { useCreateSlaRule, useUpdateSlaRule } from "@/hooks/support/use-sla-rules";
import type { SlaRule } from "@/hooks/support/use-sla-rules";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type SlaPriority = "critical" | "high" | "medium" | "low";

interface SlaRuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  rule?: SlaRule;
}

// Inner form: remounted via `key` whenever the edited rule changes, so
// useState initializers reset the form without a setState-in-effect.
function SlaRuleForm({
  onOpenChange,
  sectorId,
  rule,
}: {
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  rule?: SlaRule;
}) {
  const createMutation = useCreateSlaRule();
  const updateMutation = useUpdateSlaRule();
  const isEdit = !!rule;

  const [name, setName] = useState(rule?.name ?? "");
  const [priority, setPriority] = useState<SlaPriority>(
    (rule?.priority as SlaPriority) ?? "medium"
  );
  const [category, setCategory] = useState(rule?.category ?? "");
  const [responseTimeHours, setResponseTimeHours] = useState(
    rule?.response_time_hours ?? 1
  );
  const [resolveTimeHours, setResolveTimeHours] = useState(
    rule?.resolve_time_hours ?? 8
  );
  const [businessHoursOnly, setBusinessHoursOnly] = useState(
    rule?.business_hours_only ?? true
  );
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      sectorId,
      name,
      priority,
      category: category || undefined,
      responseTimeHours,
      resolveTimeHours,
      businessHoursOnly,
      isActive,
    };

    const result = isEdit
      ? await updateMutation.mutateAsync({ id: rule.id, data: payload })
      : await createMutation.mutateAsync(payload);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : `Erro ao ${isEdit ? "atualizar" : "criar"} regra SLA`
      );
      return;
    }

    toast.success(isEdit ? "Regra SLA atualizada" : "Regra SLA criada");
    onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>
          {isEdit ? "Editar Regra SLA" : "Nova Regra SLA"}
        </DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Atualize os tempos de resposta e resolucao"
            : "Configure tempos de SLA por prioridade"}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="sla-name">Nome</Label>
          <Input
            id="sla-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: SLA Critico"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Prioridade</Label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority((v as SlaPriority) ?? "medium")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critica</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sla-category">Categoria</Label>
            <Input
              id="sla-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sla-response">Primeira resposta (horas)</Label>
            <Input
              id="sla-response"
              type="number"
              min={1}
              value={responseTimeHours}
              onChange={(e) =>
                setResponseTimeHours(parseInt(e.target.value) || 1)
              }
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sla-resolve">Resolucao (horas)</Label>
            <Input
              id="sla-resolve"
              type="number"
              min={1}
              value={resolveTimeHours}
              onChange={(e) =>
                setResolveTimeHours(parseInt(e.target.value) || 1)
              }
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label>Somente horario comercial</Label>
          <Switch
            checked={businessHoursOnly}
            onCheckedChange={setBusinessHoursOnly}
          />
        </div>

        {isEdit && (
          <div className="flex items-center justify-between">
            <Label>Ativo</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        )}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending || !name}>
          {isPending
            ? isEdit
              ? "Salvando..."
              : "Criando..."
            : isEdit
              ? "Salvar"
              : "Criar Regra"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SlaRuleFormDialog({
  open,
  onOpenChange,
  sectorId,
  rule,
}: SlaRuleFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <SlaRuleForm
          key={rule?.id ?? "new"}
          onOpenChange={onOpenChange}
          sectorId={sectorId}
          rule={rule}
        />
      </DialogContent>
    </Dialog>
  );
}
