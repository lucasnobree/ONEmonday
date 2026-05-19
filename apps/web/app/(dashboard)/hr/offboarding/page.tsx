"use client";

import { useMemo, useState } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useSectorScope } from "@/hooks/use-sector-scope";
import { SectorScopeFilter } from "@/components/shared/sector-scope-filter";
import { sectorFilterValue } from "@/lib/navigation/scoped-query";
import { useEmployees, type Employee } from "@/hooks/hr/use-employees";
import {
  useOffboardingInstances,
  useOffboardingTemplates,
  useStartOffboarding,
  useToggleOffboardingItem,
  useCancelOffboarding,
  useDeleteOffboardingTemplate,
  type OffboardingInstance,
  type OffboardingTemplate,
} from "@/hooks/hr/use-offboarding";
import { OFFBOARDING_REASONS } from "@/lib/validations/hr";
import { OffboardingTemplateFormDialog } from "@/components/hr/offboarding-template-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  UserMinus,
  Calendar,
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  FileText,
  ListChecks,
  Play,
  Ban,
} from "lucide-react";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  in_progress: { label: "Em andamento", variant: "default" },
  completed: { label: "Concluído", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

const REASON_LABELS: Record<(typeof OFFBOARDING_REASONS)[number], string> = {
  voluntary: "Pedido de demissão",
  involuntary: "Desligamento",
  retirement: "Aposentadoria",
  end_of_contract: "Fim de contrato",
  other: "Outro",
};

export default function OffboardingPage() {
  const { scope } = useSectorScope();
  const { currentSector } = useCurrentSector();
  const { data: instances, isLoading: loadingInstances } =
    useOffboardingInstances(scope);
  const { data: templates, isLoading: loadingTemplates } =
    useOffboardingTemplates(scope);
  const deleteTemplate = useDeleteOffboardingTemplate();
  // Starting an offboarding / creating a template needs a concrete target
  // sector; under the all-sectors scope fall back to the sidebar sector.
  const createSectorId = sectorFilterValue(scope) ?? currentSector?.id ?? null;

  const [activeTab, setActiveTab] = useState<"ativos" | "templates">("ativos");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<
    OffboardingTemplate | undefined
  >();
  const [startDialogOpen, setStartDialogOpen] = useState(false);

  // When editing a template, target its own sector.
  const templateSectorId = editTemplate?.sector_id ?? createSectorId;

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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
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
          <SectorScopeFilter />
        </div>

        {activeTab === "ativos" ? (
          <Button
            size="sm"
            onClick={() => setStartDialogOpen(true)}
            disabled={!createSectorId}
          >
            <Play className="h-4 w-4 mr-1" />
            Iniciar Offboarding
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={!createSectorId}
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
        <ActiveOffboardings
          instances={instances}
          isLoading={loadingInstances}
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

      {templateSectorId && (
        <OffboardingTemplateFormDialog
          open={templateDialogOpen}
          onOpenChange={setTemplateDialogOpen}
          sectorId={templateSectorId}
          template={editTemplate}
        />
      )}

      {createSectorId && (
        <StartOffboardingDialog
          open={startDialogOpen}
          onOpenChange={setStartDialogOpen}
          sectorId={createSectorId}
          templates={templates ?? []}
        />
      )}
    </div>
  );
}

function ActiveOffboardings({
  instances,
  isLoading,
}: {
  instances: OffboardingInstance[] | undefined;
  isLoading: boolean;
}) {
  const toggleItem = useToggleOffboardingItem();
  const cancelOffboarding = useCancelOffboarding();

  async function handleToggleItem(itemId: string, completed: boolean) {
    const result = await toggleItem.mutateAsync({ itemId, completed });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao atualizar etapa"
      );
    } else {
      toast.success(completed ? "Etapa concluída!" : "Etapa reaberta");
    }
  }

  async function handleCancel(instanceId: string) {
    const result = await cancelOffboarding.mutateAsync(instanceId);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao cancelar"
      );
    } else {
      toast.success("Offboarding cancelado");
    }
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
        icon={UserMinus}
        title="Nenhum offboarding ativo"
        description="Inicie um offboarding para acompanhar o checklist de desligamento de um colaborador."
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
          totalCount > 0
            ? Math.round((completedCount / totalCount) * 100)
            : 0;
        const statusInfo = STATUS_MAP[instance.status] ?? {
          label: instance.status,
          variant: "outline" as const,
        };
        const overdueCount = instance.items.filter(
          (i) =>
            !i.is_completed &&
            i.due_date &&
            new Date(i.due_date) < new Date()
        ).length;

        return (
          <Card key={instance.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserMinus className="h-4 w-4" />
                    {instance.employee.full_name}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" />
                      {instance.employee.position}
                    </span>
                    {instance.employee.department && (
                      <span>{instance.employee.department}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Desligamento:{" "}
                      {dateFormat.format(
                        new Date(instance.termination_date)
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {overdueCount > 0 && (
                    <Badge variant="destructive">
                      {overdueCount} atrasada{overdueCount > 1 ? "s" : ""}
                    </Badge>
                  )}
                  <Badge variant={statusInfo.variant}>
                    {statusInfo.label}
                  </Badge>
                  <Badge variant="outline">
                    {completedCount}/{totalCount}
                  </Badge>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>
                      {instance.template.name}
                      {instance.reason &&
                        ` · ${
                          REASON_LABELS[
                            instance.reason as keyof typeof REASON_LABELS
                          ] ?? instance.reason
                        }`}
                    </span>
                    <span>{progress}% concluído</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                {instance.status === "in_progress" && (
                  <ConfirmDialog
                    title="Cancelar offboarding"
                    description="Tem certeza que deseja cancelar este offboarding? O checklist deixará de ser acompanhado."
                    onConfirm={() => handleCancel(instance.id)}
                  >
                    <Button variant="ghost" size="icon-sm">
                      <Ban className="h-4 w-4 text-destructive" />
                    </Button>
                  </ConfirmDialog>
                )}
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
                          handleToggleItem(item.id, !item.is_completed)
                        }
                        disabled={
                          toggleItem.isPending ||
                          instance.status === "cancelled"
                        }
                        className="mt-0.5 shrink-0 disabled:cursor-not-allowed"
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
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {item.responsible_role && (
                            <span className="text-xs text-muted-foreground">
                              Responsável: {item.responsible_role}
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
                              Concluído em{" "}
                              {dateFormat.format(
                                new Date(item.completed_at)
                              )}
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

function TemplatesList({
  templates,
  isLoading,
  onEdit,
  onDelete,
}: {
  templates: OffboardingTemplate[] | undefined;
  isLoading: boolean;
  onEdit: (template: OffboardingTemplate) => void;
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
        description="Crie templates de offboarding para padronizar o desligamento de colaboradores."
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
                  <span className="font-medium text-sm">
                    {template.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {template.description && (
                    <span>{template.description}</span>
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

function StartOffboardingDialog({
  open,
  onOpenChange,
  sectorId,
  templates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  templates: OffboardingTemplate[];
}) {
  const { data: employees } = useEmployees(sectorId);
  const startOffboarding = useStartOffboarding();

  const [employeeId, setEmployeeId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [terminationDate, setTerminationDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reason, setReason] = useState<string>("");

  const eligibleEmployees = useMemo(
    () => (employees ?? []).filter((e: Employee) => e.status !== "terminated"),
    [employees]
  );

  function resetForm() {
    setEmployeeId("");
    setTemplateId("");
    setTerminationDate(new Date().toISOString().split("T")[0]);
    setReason("");
  }

  async function handleStart() {
    if (!employeeId || !templateId || !terminationDate) return;
    const result = await startOffboarding.mutateAsync({
      employeeId,
      templateId,
      terminationDate,
      reason: reason || undefined,
    });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao iniciar offboarding"
      );
      return;
    }
    toast.success("Offboarding iniciado");
    resetForm();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar Offboarding</DialogTitle>
          <DialogDescription>
            Crie um checklist de desligamento para um colaborador.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Colaborador</Label>
            <Select
              value={employeeId}
              onValueChange={(v) => setEmployeeId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o colaborador" />
              </SelectTrigger>
              <SelectContent>
                {eligibleEmployees.map((emp: Employee) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Template</Label>
            <Select
              value={templateId}
              onValueChange={(v) => setTemplateId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum template disponível. Crie um na aba Templates.
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="offb-termination-date">
              Data de desligamento
            </Label>
            <Input
              id="offb-termination-date"
              type="date"
              value={terminationDate}
              onChange={(e) => setTerminationDate(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Motivo (opcional)</Label>
            <Select value={reason} onValueChange={(v) => setReason(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {OFFBOARDING_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {REASON_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleStart}
            disabled={
              startOffboarding.isPending ||
              !employeeId ||
              !templateId ||
              !terminationDate
            }
          >
            {startOffboarding.isPending ? "Iniciando..." : "Iniciar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
