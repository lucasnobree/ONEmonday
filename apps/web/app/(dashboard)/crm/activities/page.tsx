"use client";

import { useCurrentSector } from "@/hooks/use-current-sector";
import { useActivities } from "@/hooks/crm/use-activities";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  Mail,
  Calendar,
  StickyNote,
  CheckSquare,
} from "lucide-react";
import { ActivityCreateDialog } from "@/components/crm/activity-create-dialog";

const activityIcons: Record<string, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: StickyNote,
  task: CheckSquare,
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

export default function ActivitiesPage() {
  const { currentSector } = useCurrentSector();
  const { data: activities, isLoading } = useActivities({
    sectorId: currentSector?.id,
  });

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

  if (!activities || activities.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Atividades Recentes</h2>
          <ActivityCreateDialog sectorId={currentSector.id} />
        </div>
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhuma atividade registrada ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Atividades Recentes</h2>
        <ActivityCreateDialog sectorId={currentSector.id} />
      </div>

      <div className="relative space-y-0">
        <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

        {activities.map((activity) => {
          const Icon = activityIcons[activity.type] ?? StickyNote;

          return (
            <div key={activity.id} className="relative flex gap-4 pb-6">
              <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted border">
                <Icon className="h-4 w-4 text-muted-foreground" />
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
                    {activity.description && <p>{activity.description}</p>}
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
    </div>
  );
}
