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

import { WEEKDAY_LABELS, formatMinuteOfDay } from "@/lib/support/business-hours";

type SlaPriority = "critical" | "high" | "medium" | "low";
type SlaBreachAction = "none" | "notify" | "escalate";

const PRIORITY_LABELS: Record<SlaPriority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const BREACH_LABELS: Record<SlaBreachAction, string> = {
  none: "Nenhuma (apenas painel)",
  notify: "Notificar responsável",
  escalate: "Escalar automaticamente",
};

/** "HH:MM" string -> minutes from midnight. */
function parseClock(value: string): number {
  const [h, m] = value.split(":").map((p) => parseInt(p, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

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
  // Business-hours schedule.
  const [startMinute, setStartMinute] = useState(
    rule?.business_start_minute ?? 540
  );
  const [endMinute, setEndMinute] = useState(
    rule?.business_end_minute ?? 1080
  );
  const [daysMask, setDaysMask] = useState(rule?.business_days_mask ?? 62);
  // Breach escalation action + warn threshold.
  const [breachAction, setBreachAction] = useState<SlaBreachAction>(
    (rule?.breach_action as SlaBreachAction) ?? "none"
  );
  const [warnThresholdPct, setWarnThresholdPct] = useState(
    rule?.warn_threshold_pct ?? 80
  );

  // Toggle one weekday bit in the working-days bitset.
  const toggleDay = (day: number) => {
    setDaysMask((mask) => mask ^ (1 << day));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (endMinute <= startMinute) {
      toast.error("O fim do expediente deve ser depois do início");
      return;
    }

    const payload = {
      sectorId,
      name,
      priority,
      category: category || undefined,
      responseTimeHours,
      resolveTimeHours,
      businessHoursOnly,
      isActive,
      businessTimezone: rule?.business_timezone ?? "America/Sao_Paulo",
      businessStartMinute: startMinute,
      businessEndMinute: endMinute,
      businessDaysMask: daysMask,
      breachAction,
      warnThresholdPct,
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
            ? "Atualize os tempos de resposta e resolução"
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
            placeholder="Ex: SLA Crítico"
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
                <SelectValue>
                  {(value) =>
                    PRIORITY_LABELS[value as SlaPriority] ?? "Selecione"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Crítica</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
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
            <Label htmlFor="sla-resolve">Resolução (horas)</Label>
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
          <Label>Somente horário comercial</Label>
          <Switch
            checked={businessHoursOnly}
            onCheckedChange={setBusinessHoursOnly}
          />
        </div>

        {businessHoursOnly && (
          <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              O relógio de SLA só conta o tempo dentro deste expediente.
            </p>
            <div className="grid gap-1.5">
              <Label className="text-xs">Dias úteis</Label>
              <div className="flex flex-wrap gap-1">
                {WEEKDAY_LABELS.map((label, day) => {
                  const active = (daysMask & (1 << day)) !== 0;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleDay(day)}
                      aria-pressed={active}
                      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="sla-start" className="text-xs">
                  Início
                </Label>
                <Input
                  id="sla-start"
                  type="time"
                  value={formatMinuteOfDay(startMinute)}
                  onChange={(e) => setStartMinute(parseClock(e.target.value))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sla-end" className="text-xs">
                  Fim
                </Label>
                <Input
                  id="sla-end"
                  type="time"
                  value={formatMinuteOfDay(endMinute)}
                  onChange={(e) => setEndMinute(parseClock(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <Label>Ação em caso de violação</Label>
          <Select
            value={breachAction}
            onValueChange={(v) =>
              setBreachAction((v as SlaBreachAction) ?? "none")
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value) =>
                  BREACH_LABELS[value as SlaBreachAction] ?? "Selecione"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{BREACH_LABELS.none}</SelectItem>
              <SelectItem value="notify">{BREACH_LABELS.notify}</SelectItem>
              <SelectItem value="escalate">
                {BREACH_LABELS.escalate}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {breachAction !== "none" && (
          <div className="grid gap-2">
            <Label htmlFor="sla-warn">
              Alertar ao atingir (% do prazo)
            </Label>
            <Input
              id="sla-warn"
              type="number"
              min={1}
              max={100}
              value={warnThresholdPct}
              onChange={(e) =>
                setWarnThresholdPct(
                  Math.min(100, Math.max(1, parseInt(e.target.value) || 80))
                )
              }
            />
          </div>
        )}

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
