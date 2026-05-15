"use client";

import {
  useOnboardingDetail,
  useCompleteOnboardingItem,
} from "@/hooks/hr/use-onboarding";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Calendar, UserCog } from "lucide-react";
import { toast } from "sonner";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const statusMap: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  in_progress: { label: "Em andamento", variant: "default" },
  completed: { label: "Concluido", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

interface OnboardingDetailSheetProps {
  instanceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingDetailSheet({
  instanceId,
  open,
  onOpenChange,
}: OnboardingDetailSheetProps) {
  const { data: instance, isLoading } = useOnboardingDetail(
    open ? instanceId : null
  );
  const toggleItem = useCompleteOnboardingItem();

  async function handleToggle(itemId: string, completed: boolean) {
    try {
      await toggleItem.mutateAsync({ itemId, completed });
      toast.success(completed ? "Etapa concluida!" : "Etapa reaberta");
    } catch {
      toast.error("Erro ao atualizar etapa");
    }
  }

  const completedCount = instance?.items.filter((i) => i.is_completed).length ?? 0;
  const totalCount = instance?.items.length ?? 0;
  const progress =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        {isLoading || !instance ? (
          <div className="p-4 space-y-4">
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded bg-muted animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <UserCog className="h-5 w-5" />
                  <SheetTitle>{instance.employee.full_name}</SheetTitle>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{instance.template.name}</span>
                  <Badge
                    variant={statusMap[instance.status]?.variant ?? "outline"}
                  >
                    {statusMap[instance.status]?.label ?? instance.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    Inicio: {dateFormat.format(new Date(instance.start_date))}
                  </span>
                  {instance.completed_at && (
                    <span className="ml-2">
                      Concluido:{" "}
                      {dateFormat.format(new Date(instance.completed_at))}
                    </span>
                  )}
                </div>
              </div>
            </SheetHeader>

            <div className="px-4 pb-4 mt-4 space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Progresso</span>
                  <span>
                    {completedCount}/{totalCount} ({progress}%)
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

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
                          handleToggle(item.id, !item.is_completed)
                        }
                        disabled={toggleItem.isPending}
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
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {item.responsible_role && (
                            <span className="text-xs text-muted-foreground">
                              Responsavel: {item.responsible_role}
                            </span>
                          )}
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
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
