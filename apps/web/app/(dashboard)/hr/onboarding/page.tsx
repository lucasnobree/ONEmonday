"use client";

import { useCurrentSector } from "@/hooks/use-current-sector";
import {
  useOnboardingInstances,
  useCompleteOnboardingItem,
} from "@/hooks/hr/use-onboarding";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  UserCog,
  Calendar,
  Briefcase,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const statusMap: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  in_progress: { label: "Em andamento", variant: "default" },
  completed: { label: "Concluido", variant: "secondary" },
  pending: { label: "Pendente", variant: "outline" },
};

export default function OnboardingPage() {
  const { currentSector } = useCurrentSector();
  const { data: instances, isLoading } = useOnboardingInstances(
    currentSector?.id
  );
  const completeItem = useCompleteOnboardingItem();

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para ver os onboardings.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (!instances || instances.length === 0) {
    return (
      <EmptyState
        icon={UserCog}
        title="Nenhum onboarding ativo"
        description="Onboardings aparecerao aqui quando novos colaboradores forem adicionados com um template de integracao."
      />
    );
  }

  async function handleComplete(itemId: string) {
    try {
      await completeItem.mutateAsync(itemId);
      toast.success("Etapa concluida!");
    } catch {
      toast.error("Erro ao concluir etapa");
    }
  }

  return (
    <div className="space-y-6">
      {instances.map((instance) => {
        const completedCount = instance.items.filter(
          (i) => i.is_completed
        ).length;
        const totalCount = instance.items.length;
        const progress =
          totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        const statusInfo = statusMap[instance.status] ?? {
          label: instance.status,
          variant: "outline" as const,
        };

        return (
          <Card key={instance.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCog className="h-4 w-4" />
                    {instance.employee.full_name}
                  </CardTitle>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" />
                      {instance.employee.position}
                    </span>
                    {instance.employee.department && (
                      <span>{instance.employee.department}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Inicio:{" "}
                      {dateFormat.format(new Date(instance.start_date))}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusInfo.variant}>
                    {statusInfo.label}
                  </Badge>
                  <Badge variant="outline">
                    {completedCount}/{totalCount}
                  </Badge>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{instance.template.name}</span>
                  <span>{progress}% concluido</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-2">
                {instance.items.map((item) => {
                  const isOverdue =
                    !item.is_completed &&
                    item.due_date &&
                    new Date(item.due_date) < new Date();

                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                        item.is_completed
                          ? "bg-muted/50 opacity-70"
                          : isOverdue
                          ? "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10"
                          : ""
                      }`}
                    >
                      <button
                        onClick={() =>
                          !item.is_completed && handleComplete(item.id)
                        }
                        disabled={item.is_completed || completeItem.isPending}
                        className="mt-0.5 shrink-0"
                      >
                        {item.is_completed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium ${
                            item.is_completed
                              ? "line-through text-muted-foreground"
                              : ""
                          }`}
                        >
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {item.due_date && (
                            <span
                              className={`text-xs ${
                                isOverdue
                                  ? "text-red-600 font-medium"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {isOverdue ? "Atrasado: " : "Prazo: "}
                              {dateFormat.format(new Date(item.due_date))}
                            </span>
                          )}
                          {item.completed_at && (
                            <span className="text-xs text-green-600">
                              Concluido em{" "}
                              {dateFormat.format(new Date(item.completed_at))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
