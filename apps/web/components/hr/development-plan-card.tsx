"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addDevelopmentAction,
  toggleDevelopmentAction,
  updateDevelopmentPlanStatus,
} from "@/lib/actions/hr/performance";
import type { DevelopmentPlan } from "@/hooks/hr/use-performance";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  active: { label: "Ativo", variant: "default" },
  completed: { label: "Concluído", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

export function DevelopmentPlanCard({ plan }: { plan: DevelopmentPlan }) {
  const queryClient = useQueryClient();
  const [newAction, setNewAction] = useState("");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["hr-development-plans"] });
  }

  const addMutation = useMutation({
    mutationFn: () => addDevelopmentAction({ planId: plan.id, title: newAction }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string" ? result.error : "Erro ao adicionar ação"
        );
        return;
      }
      setNewAction("");
      invalidate();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { actionId: string; isCompleted: boolean }) =>
      toggleDevelopmentAction(vars),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string" ? result.error : "Erro ao atualizar ação"
        );
        return;
      }
      invalidate();
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: "active" | "completed" | "cancelled") =>
      updateDevelopmentPlanStatus(plan.id, status),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string" ? result.error : "Erro ao atualizar PDI"
        );
        return;
      }
      invalidate();
    },
  });

  const done = plan.actions.filter((a) => a.is_completed).length;
  const status = STATUS_MAP[plan.status] ?? STATUS_MAP.active;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{plan.title}</p>
            <p className="text-sm text-muted-foreground">{plan.employee_name}</p>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        {plan.objective && (
          <p className="text-sm text-muted-foreground">{plan.objective}</p>
        )}
        {plan.target_date && (
          <p className="text-xs text-muted-foreground">
            Prazo: {dateFormat.format(new Date(plan.target_date))}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">
          Ações ({done}/{plan.actions.length})
        </p>
        <div className="space-y-1.5">
          {plan.actions.map((action) => (
            <label
              key={action.id}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={action.is_completed}
                onChange={(e) =>
                  toggleMutation.mutate({
                    actionId: action.id,
                    isCompleted: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-input"
              />
              <span
                className={
                  action.is_completed
                    ? "line-through text-muted-foreground"
                    : ""
                }
              >
                {action.title}
              </span>
              {action.due_date && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {dateFormat.format(new Date(action.due_date))}
                </span>
              )}
            </label>
          ))}
          {plan.actions.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhuma ação cadastrada.
            </p>
          )}
        </div>

        {plan.status === "active" && (
          <>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newAction.trim()) addMutation.mutate();
              }}
            >
              <Input
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
                placeholder="Nova ação"
                className="h-8"
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={addMutation.isPending || !newAction.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </form>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => statusMutation.mutate("completed")}
                disabled={statusMutation.isPending}
              >
                Concluir PDI
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => statusMutation.mutate("cancelled")}
                disabled={statusMutation.isPending}
              >
                Cancelar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
