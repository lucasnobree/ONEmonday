"use client";

import { useState, useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import {
  useActivities,
  useCompleteActivity,
  type Activity,
} from "@/hooks/crm/use-activities";
import { useCrmMembers } from "@/hooks/crm/use-crm-members";
import { bucketActivity, countOpenTasks } from "@/lib/crm/activity-tasks";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/shared/filter-select";
import {
  Phone,
  Mail,
  Calendar,
  StickyNote,
  CheckSquare,
  Download,
  AlertTriangle,
  Clock,
  Circle,
  CheckCircle2,
} from "lucide-react";
import { ActivityCreateDialog } from "@/components/crm/activity-create-dialog";
import { exportToCSV } from "@/lib/utils/export-csv";
import { toast } from "sonner";

const activityIcons: Record<string, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: StickyNote,
  task: CheckSquare,
};

const activityColors: Record<string, string> = {
  call: "text-blue-500 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
  email: "text-purple-500 bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800",
  meeting: "text-green-500 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
  note: "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800",
  task: "text-gray-500 bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700",
};

const activityLabels: Record<string, string> = {
  call: "Chamada",
  email: "Email",
  meeting: "Reunião",
  note: "Nota",
  task: "Tarefa",
};

const activityVariants: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  call: "default",
  email: "secondary",
  meeting: "outline",
  note: "secondary",
  task: "outline",
};

const TYPES = ["all", "call", "email", "meeting", "note", "task"] as const;
const TYPE_LABELS: Record<string, string> = {
  all: "Todos",
  call: "Chamadas",
  email: "Emails",
  meeting: "Reuniões",
  note: "Notas",
  task: "Tarefas",
};

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function ActivitiesPage() {
  const { currentSector } = useCurrentSector();
  const { data: activities, isLoading } = useActivities({
    sectorId: currentSector?.id,
  });
  const { data: members } = useCrmMembers(currentSector?.id);
  const completeActivity = useCompleteActivity();
  const [tab, setTab] = useState<"tasks" | "history">("tasks");
  const [typeFilter, setTypeFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Stable "now" for one render pass so every bucket calculation agrees.
  const now = useMemo(() => new Date(), []);

  const baseFiltered = useMemo(() => {
    if (!activities) return [];
    let result = activities;
    if (typeFilter !== "all") {
      result = result.filter((a) => a.type === typeFilter);
    }
    if (ownerFilter !== "all") {
      result = result.filter(
        (a) => a.assigned_to === ownerFilter || a.performed_by === ownerFilter
      );
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((a) => new Date(a.created_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59");
      result = result.filter((a) => new Date(a.created_at) <= to);
    }
    return result;
  }, [activities, typeFilter, ownerFilter, dateFrom, dateTo]);

  // Split into open tasks (scheduled, incomplete) and the historical feed.
  const { openTasks, historyFeed } = useMemo(() => {
    const open: Activity[] = [];
    const history: Activity[] = [];
    for (const a of baseFiltered) {
      const bucket = bucketActivity(a, now);
      if (bucket === "overdue" || bucket === "today" || bucket === "upcoming") {
        open.push(a);
      } else {
        history.push(a);
      }
    }
    // Open tasks: soonest due first.
    open.sort(
      (a, b) =>
        new Date(a.scheduled_at!).getTime() -
        new Date(b.scheduled_at!).getTime()
    );
    return { openTasks: open, historyFeed: history };
  }, [baseFiltered, now]);

  const counts = useMemo(
    () => countOpenTasks(activities ?? [], now),
    [activities, now]
  );

  const handleComplete = async (activity: Activity, completed: boolean) => {
    const result = await completeActivity.mutateAsync({
      activityId: activity.id,
      completed,
    });
    if (result && "error" in result && result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao atualizar tarefa"
      );
      return;
    }
    toast.success(completed ? "Tarefa concluída" : "Tarefa reaberta");
  };

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar as atividades.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Atividades</h2>
          <ActivityCreateDialog sectorId={currentSector.id} />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const visible = tab === "tasks" ? openTasks : historyFeed;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Atividades</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!visible.length}
            onClick={() =>
              exportToCSV(
                visible.map((a) => ({
                  tipo: activityLabels[a.type] ?? a.type,
                  assunto: a.subject,
                  descricao: a.description ?? "",
                  responsavel:
                    a.assignee?.full_name ?? a.user?.full_name ?? "",
                  agendado: a.scheduled_at
                    ? new Date(a.scheduled_at).toLocaleString("pt-BR")
                    : "",
                  concluido: a.completed_at
                    ? new Date(a.completed_at).toLocaleString("pt-BR")
                    : "",
                  deal: a.deal?.cards?.title ?? "",
                  contato: a.contact?.full_name ?? "",
                  empresa: a.company?.name ?? "",
                  data: new Date(a.created_at).toLocaleString("pt-BR"),
                })),
                `atividades-${new Date().toISOString().split("T")[0]}`,
                [
                  { key: "tipo", label: "Tipo" },
                  { key: "assunto", label: "Assunto" },
                  { key: "descricao", label: "Descrição" },
                  { key: "responsavel", label: "Responsável" },
                  { key: "agendado", label: "Agendado para" },
                  { key: "concluido", label: "Concluído em" },
                  { key: "deal", label: "Deal" },
                  { key: "contato", label: "Contato" },
                  { key: "empresa", label: "Empresa" },
                  { key: "data", label: "Criado em" },
                ]
              )
            }
          >
            <Download className="size-4 mr-1" />
            Exportar
          </Button>
          <ActivityCreateDialog sectorId={currentSector.id} />
        </div>
      </div>

      {/* Open-task summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-red-500" />
            <div>
              <p className="text-xs text-muted-foreground">Atrasadas</p>
              <p className="text-lg font-bold">{counts.overdue}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <Clock className="size-4 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Hoje</p>
              <p className="text-lg font-bold">{counts.today}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <Calendar className="size-4 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Próximas</p>
              <p className="text-lg font-bold">{counts.upcoming}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: tasks vs history */}
      <div className="inline-flex h-9 items-center rounded-lg bg-muted p-0.75 text-muted-foreground">
        <button
          type="button"
          onClick={() => setTab("tasks")}
          className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-all ${
            tab === "tasks"
              ? "bg-background text-foreground shadow-sm"
              : "hover:text-foreground"
          }`}
        >
          Tarefas pendentes ({counts.openTotal})
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-all ${
            tab === "history"
              ? "bg-background text-foreground shadow-sm"
              : "hover:text-foreground"
          }`}
        >
          Histórico
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="inline-flex h-8 items-center rounded-lg bg-muted p-0.75 text-muted-foreground">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-medium transition-all ${
                typeFilter === t
                  ? "bg-background text-foreground shadow-sm"
                  : "hover:text-foreground"
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Responsável</Label>
          <FilterSelect
            value={ownerFilter}
            onValueChange={setOwnerFilter}
            className="w-44 text-xs"
            aria-label="Filtrar por responsável"
            options={[
              { value: "all", label: "Todos" },
              ...(members || []).map((m) => ({
                value: m.id,
                label: m.full_name,
              })),
            ]}
          />
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-35 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-35 text-xs"
            />
          </div>
          {(dateFrom || dateTo || ownerFilter !== "all" || typeFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setOwnerFilter("all");
                setTypeFilter("all");
              }}
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {tab === "tasks"
            ? "Nenhuma tarefa pendente."
            : "Nenhuma atividade no histórico."}
        </p>
      ) : tab === "tasks" ? (
        <div className="space-y-2">
          {visible.map((activity) => {
            const Icon = activityIcons[activity.type] ?? StickyNote;
            const bucket = bucketActivity(activity, now);
            const isOverdueTask = bucket === "overdue";
            return (
              <Card
                key={activity.id}
                className={isOverdueTask ? "border-red-300 dark:border-red-900" : ""}
              >
                <CardContent className="p-3 flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      handleComplete(activity, !activity.completed_at)
                    }
                    disabled={completeActivity.isPending}
                    title={
                      activity.completed_at
                        ? "Reabrir tarefa"
                        : "Concluir tarefa"
                    }
                    className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {activity.completed_at ? (
                      <CheckCircle2 className="size-5 text-green-600" />
                    ) : (
                      <Circle className="size-5" />
                    )}
                  </button>
                  <Icon className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {activity.subject}
                      </span>
                      <Badge
                        variant={activityVariants[activity.type] ?? "secondary"}
                      >
                        {activityLabels[activity.type] ?? activity.type}
                      </Badge>
                      {isOverdueTask && (
                        <Badge variant="destructive">Atrasada</Badge>
                      )}
                      {bucket === "today" && (
                        <Badge variant="secondary">Hoje</Badge>
                      )}
                    </div>
                    {activity.description && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">
                        {activity.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {activity.scheduled_at &&
                        `Prazo: ${dateTimeFormat.format(
                          new Date(activity.scheduled_at)
                        )}`}
                      {activity.assignee?.full_name &&
                        ` · ${activity.assignee.full_name}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="relative space-y-0">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
          {visible.map((activity) => {
            const Icon = activityIcons[activity.type] ?? StickyNote;
            const colors = activityColors[activity.type] ?? activityColors.note;
            return (
              <div key={activity.id} className="relative flex gap-4 pb-6">
                <div
                  className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${colors}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <Card className="flex-1">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-medium">
                        {activity.subject}
                      </CardTitle>
                      <Badge
                        variant={activityVariants[activity.type] ?? "secondary"}
                      >
                        {activityLabels[activity.type] ?? activity.type}
                      </Badge>
                      {activity.completed_at && (
                        <Badge variant="secondary">Concluída</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {activity.user?.full_name ?? "Usuario"} &middot;{" "}
                      {dateTimeFormat.format(new Date(activity.created_at))}
                      {activity.duration_min
                        ? ` · ${activity.duration_min}min`
                        : ""}
                    </p>
                  </CardHeader>
                  {(activity.description ||
                    activity.deal ||
                    activity.contact ||
                    activity.company) && (
                    <CardContent className="space-y-1 text-sm text-muted-foreground">
                      {activity.description && (
                        <p className="whitespace-pre-wrap">
                          {activity.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 text-xs">
                        {activity.deal?.cards?.title && (
                          <span>Deal: {activity.deal.cards.title}</span>
                        )}
                        {activity.contact?.full_name && (
                          <span>Contato: {activity.contact.full_name}</span>
                        )}
                        {activity.company?.name && (
                          <span>Empresa: {activity.company.name}</span>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
