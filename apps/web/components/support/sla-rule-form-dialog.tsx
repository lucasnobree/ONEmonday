"use client";

import { useState, useEffect } from "react";
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

interface SlaRuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  rule?: SlaRule;
}

export function SlaRuleFormDialog({
  open,
  onOpenChange,
  sectorId,
  rule,
}: SlaRuleFormDialogProps) {
  const createMutation = useCreateSlaRule();
  const updateMutation = useUpdateSlaRule();
  const isEdit = !!rule;

  const [name, setName] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("");
  const [responseTimeHours, setResponseTimeHours] = useState(1);
  const [resolveTimeHours, setResolveTimeHours] = useState(8);
  const [businessHoursOnly, setBusinessHoursOnly] = useState(true);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setPriority(rule.priority);
      setCategory(rule.category ?? "");
      setResponseTimeHours(rule.response_time_hours);
      setResolveTimeHours(rule.resolve_time_hours);
      setBusinessHoursOnly(rule.business_hours_only);
      setIsActive(rule.is_active);
    } else {
      setName("");
      setPriority("medium");
      setCategory("");
      setResponseTimeHours(1);
      setResolveTimeHours(8);
      setBusinessHoursOnly(true);
      setIsActive(true);
    }
  }, [rule, open]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
                  onValueChange={(v) => setPriority(v ?? "medium")}
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
                <Label htmlFor="sla-response">
                  Primeira resposta (horas)
                </Label>
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
              <Label htmlFor="sla-bh">Somente horario comercial</Label>
              <Switch
                checked={businessHoursOnly}
                onCheckedChange={setBusinessHoursOnly}
              />
            </div>

            {isEdit && (
              <div className="flex items-center justify-between">
                <Label htmlFor="sla-active">Ativo</Label>
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
      </DialogContent>
    </Dialog>
  );
}
