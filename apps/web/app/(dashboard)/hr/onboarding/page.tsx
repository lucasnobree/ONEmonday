"use client";

import { useState } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import {
  useOnboardingInstances,
  useOnboardingTemplates,
  useCompleteOnboardingItem,
  useDeleteOnboardingTemplate,
  type OnboardingTemplate,
} from "@/hooks/hr/use-onboarding";
import { OnboardingTemplateFormDialog } from "@/components/hr/onboarding-template-form-dialog";
import { OnboardingDetailSheet } from "@/components/hr/onboarding-detail-sheet";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  UserCog,
  Calendar,
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  FileText,
  ListChecks,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const statusMap: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  in_progress: { label: "Em andamento", variant: "default" },
  completed: { label: "Concluído", variant: "secondary" },
  pending: { label: "Pendente", variant: "outline" },
};

export default function OnboardingPage() {
  const { currentSector } = useCurrentSector();
  const { data: instances, isLoading: loadingInstances } =
    useOnboardingInstances(currentSector?.id);
  const { data: templates, isLoading: loadingTemplates } =
    useOnboardingTemplates(currentSector?.id);
  const completeItem = useCompleteOnboardingItem();
  const deleteTemplate = useDeleteOnboardingTemplate();

  const [activeTab, setActiveTab] = useState<"ativos" | "templates">("ativos");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<OnboardingTemplate | undefined>();
  const [detailInstanceId, setDetailInstanceId] = useState<string | null>(null);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para ver os onboardings.
      </p>
    );
  }

  async function handleToggleItem(itemId: string, completed: boolean) {
    try {
      await completeItem.mutateAsync({ itemId, completed });
      toast.success(completed ? "Etapa concluída!" : "Etapa reaberta");
    } catch {
      toast.error("Erro ao atualizar etapa");
    }
  }

  async function handleDeleteTemplate(id: string) {
    const result = await deleteTemplate.mutateAsync(id);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao excluir"
      );
    } else {
      toast.success("Template excluído");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="inline-flex h-8 items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground">
          <button
            onClick={() => setActiveTab("ativos")}
            className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-all ${
              activeTab === "ativos"
                ? "bg-background text-foreground shadow-sm"
                : "hover:text-foreground"
            }`}
          >
            Ativos
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-all ${
              activeTab === "templates"
                ? "bg-background text-foreground shadow-sm"
                : "hover:text-foreground"
            }`}
          >
            Templates
          </button>
        </div>

        {activeTab === "templates" && (
          <Button
            size="sm"
            onClick={() => {
              setEditTemplate(undefined);
              setTemplateDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo Template
          </Button>
        )}
      </div>

      {activeTab === "ativos" && (
        <ActiveOnboardings
          instances={instances}
          isLoading={loadingInstances}
          completeItem={completeItem}
          onToggleItem={handleToggleItem}
          onOpenDetail={setDetailInstanceId}
        />
      )}

      {activeTab === "templates" && (
        <TemplatesList
          templates={templates}
          isLoading={loadingTemplates}
          onEdit={(t) => {
            setEditTemplate(t);
            setTemplateDialogOpen(true);
          }}
          onDelete={handleDeleteTemplate}
        />
      )}

      <OnboardingTemplateFormDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        sectorId={currentSector.id}
        template={editTemplate}
      />

      <OnboardingDetailSheet
        instanceId={detailInstanceId}
        open={!!detailInstanceId}
        onOpenChange={(open) => {
          if (!open) setDetailInstanceId(null);
        }}
      />
    </div>
  );
}

function ActiveOnboardings({
  instances,
  isLoading,
  completeItem,
  onToggleItem,
  onOpenDetail,
}: {
  instances: ReturnType<typeof useOnboardingInstances>["data"];
  isLoading: boolean;
  completeItem: ReturnType<typeof useCompleteOnboardingItem>;
  onToggleItem: (itemId: string, completed: boolean) => void;
  onOpenDetail: (instanceId: string) => void;
}) {
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
        description="Onboardings aparecerão aqui quando novos colaboradores forem adicionados com um template de integração."
      />
    );
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
          <Card
            key={instance.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onOpenDetail(instance.id)}
          >
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
                      Início:{" "}
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
                  <span>{progress}% concluído</span>
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
                {instance.items.slice(0, 5).map((item) => {
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
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleItem(item.id, !item.is_completed);
                        }}
                        disabled={completeItem.isPending}
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
                              Concluído em{" "}
                              {dateFormat.format(new Date(item.completed_at))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {instance.items.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{instance.items.length - 5} etapas
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TemplatesList({
  templates,
  isLoading,
  onEdit,
  onDelete,
}: {
  templates: OnboardingTemplate[] | undefined;
  isLoading: boolean;
  onEdit: (template: OnboardingTemplate) => void;
  onDelete: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Nenhum template criado"
        description="Crie templates de onboarding para padronizar a integração de novos colaboradores."
      />
    );
  }

  return (
    <div className="space-y-3">
      {templates.map((template) => (
        <Card key={template.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{template.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {template.position && (
                    <span>Cargo: {template.position}</span>
                  )}
                  <span>
                    {template.items.length}{" "}
                    {template.items.length === 1 ? "etapa" : "etapas"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onEdit(template)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <ConfirmDialog
                  title="Excluir template"
                  description="Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita."
                  onConfirm={() => onDelete(template.id)}
                >
                  <Button variant="ghost" size="icon-sm">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </ConfirmDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
