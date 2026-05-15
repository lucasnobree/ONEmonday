"use client";

import { useState, useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useActivities } from "@/hooks/crm/use-activities";
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
import {
  Phone,
  Mail,
  Calendar,
  StickyNote,
  CheckSquare,
  Download,
} from "lucide-react";
import { ActivityCreateDialog } from "@/components/crm/activity-create-dialog";
import { exportToCSV } from "@/lib/utils/export-csv";

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
  meeting: "Reuniao",
  note: "Nota",
  task: "Tarefa",
};

const activityVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
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
  meeting: "Reunioes",
  note: "Notas",
  task: "Tarefas",
};

export default function ActivitiesPage() {
  const { currentSector } = useCurrentSector();
  const { data: activities, isLoading } = useActivities({
    sectorId: currentSector?.id,
  });
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    if (!activities) return [];
    let result = activities;
    if (typeFilter !== "all") {
      result = result.filter((a) => a.type === typeFilter);
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
  }, [activities, typeFilter, dateFrom, dateTo]);

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
          <h2 className="text-lg font-semibold">Atividades Recentes</h2>
          <ActivityCreateDialog sectorId={currentSector.id} />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Atividades Recentes</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!filtered.length}
            onClick={() =>
              exportToCSV(
                filtered.map((a) => ({
                  tipo: activityLabels[a.type] ?? a.type,
                  assunto: a.subject,
                  descricao: a.description ?? "",
                  responsavel: a.user?.full_name ?? "",
                  deal: a.deal?.cards?.title ?? "",
                  contato: a.contact?.full_name ?? "",
                  empresa: a.company?.name ?? "",
                  duracao_min: a.duration_min ?? "",
                  data: new Date(a.created_at).toLocaleString("pt-BR"),
                })),
                `atividades-${new Date().toISOString().split("T")[0]}`,
                [
                  { key: "tipo", label: "Tipo" },
                  { key: "assunto", label: "Assunto" },
                  { key: "descricao", label: "Descricao" },
                  { key: "responsavel", label: "Responsavel" },
                  { key: "deal", label: "Deal" },
                  { key: "contato", label: "Contato" },
                  { key: "empresa", label: "Empresa" },
                  { key: "duracao_min", label: "Duracao (min)" },
                  { key: "data", label: "Data" },
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="inline-flex h-8 items-center rounded-lg bg-muted p-[3px] text-muted-foreground">
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
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-[140px] text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ate</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-[140px] text-xs"
            />
          </div>
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhuma atividade encontrada.
        </p>
      ) : (
        <div className="relative space-y-0">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

          {filtered.map((activity) => {
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
                      <Badge variant={activityVariants[activity.type] ?? "secondary"}>
                        {activityLabels[activity.type] ?? activity.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {activity.user?.full_name ?? "Usuario"} &middot;{" "}
                      {new Date(activity.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {activity.duration_min
                        ? ` \u00B7 ${activity.duration_min}min`
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
