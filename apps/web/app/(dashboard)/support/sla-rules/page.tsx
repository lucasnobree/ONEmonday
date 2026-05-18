"use client";

import { useState } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import {
  useSLARules,
  useDeleteSlaRule,
  useToggleSlaRule,
} from "@/hooks/support/use-sla-rules";
import type { SlaRule } from "@/hooks/support/use-sla-rules";
import { PermissionGate } from "@/components/shared/permission-gate";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SlaRuleFormDialog } from "@/components/support/sla-rule-form-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ShieldCheck, Plus, Pencil, Trash2 } from "lucide-react";

const priorityLabels: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

function formatHours(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remaining = hours % 24;
  if (remaining === 0) return `${days}d`;
  return `${days}d ${remaining}h`;
}

export default function SLARulesPage() {
  const { currentSector } = useCurrentSector();
  const { data: rules, isLoading } = useSLARules(currentSector?.id);
  const deleteMutation = useDeleteSlaRule();
  const toggleMutation = useToggleSlaRule();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SlaRule | undefined>();

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar as Regras SLA.
      </p>
    );
  }

  function handleEdit(rule: SlaRule) {
    setEditingRule(rule);
    setDialogOpen(true);
  }

  function handleCreate() {
    setEditingRule(undefined);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    const result = await deleteMutation.mutateAsync(id);
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao excluir regra"
      );
      return;
    }
    toast.success("Regra SLA excluída");
  }

  async function handleToggle(id: string, isActive: boolean) {
    const result = await toggleMutation.mutateAsync({ id, isActive });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao alterar status"
      );
      return;
    }
    toast.success(isActive ? "Regra ativada" : "Regra desativada");
  }

  return (
    <PermissionGate
      sectorId={currentSector.id}
      resource="sla_rule"
      action="read"
      fallback={
        <p className="text-muted-foreground">
          Você não tem permissão para acessar as Regras SLA deste setor.
        </p>
      }
    >
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Regras de SLA</CardTitle>
                <CardDescription>
                  Tempos de resposta e resolução configurados por prioridade
                </CardDescription>
              </div>
              <Button size="sm" onClick={handleCreate}>
                <Plus className="size-4 mr-1" />
                Nova Regra SLA
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !rules?.length ? (
              <div className="py-12 text-center">
                <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma regra SLA configurada ainda.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Nome</th>
                      <th className="pb-2 font-medium">Prioridade</th>
                      <th className="pb-2 font-medium">Categoria</th>
                      <th className="pb-2 font-medium">Tempo de Resposta</th>
                      <th className="pb-2 font-medium">Tempo de Resolução</th>
                      <th className="pb-2 font-medium">Horário Comercial</th>
                      <th className="pb-2 font-medium">Ativo</th>
                      <th className="pb-2 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => (
                      <tr
                        key={rule.id}
                        className="border-b last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-3 pr-4 font-medium">{rule.name}</td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant="secondary"
                            className={priorityColors[rule.priority] || ""}
                          >
                            {priorityLabels[rule.priority] || rule.priority}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {rule.category || "Todas"}
                        </td>
                        <td className="py-3 pr-4 font-mono text-muted-foreground">
                          {formatHours(rule.response_time_hours)}
                        </td>
                        <td className="py-3 pr-4 font-mono text-muted-foreground">
                          {formatHours(rule.resolve_time_hours)}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant={
                              rule.business_hours_only ? "secondary" : "outline"
                            }
                          >
                            {rule.business_hours_only ? "Sim" : "Não"}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={(checked) =>
                              handleToggle(rule.id, checked)
                            }
                          />
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleEdit(rule)}
                              title="Editar"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <ConfirmDialog
                              title="Excluir regra SLA"
                              description={`A regra "${rule.name}" será removida permanentemente. Esta ação não pode ser desfeita.`}
                              onConfirm={() => handleDelete(rule.id)}
                            >
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Excluir"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </ConfirmDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SlaRuleFormDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditingRule(undefined);
        }}
        sectorId={currentSector.id}
        rule={editingRule}
      />
    </PermissionGate>
  );
}
