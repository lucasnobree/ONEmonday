"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Activity {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
  user_id: string;
  users: { full_name: string } | null;
}

const actionLabels: Record<string, string> = {
  card_created: "criou o card",
  card_updated: "atualizou o card",
  comment_added: "adicionou um comentario",
  attachment_added: "anexou um arquivo",
  assignee_added: "atribuiu um membro",
  checklist_created: "criou uma checklist",
  card_moved: "moveu o card",
  escalation_created: "escalou o card",
};

interface ActivityFeedProps {
  activities: Activity[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma atividade registrada.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => {
        const initials =
          activity.users?.full_name
            ?.split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() ?? "?";

        return (
          <div key={activity.id} className="flex items-start gap-3">
            <Avatar size="sm" className="shrink-0">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm">
                <span className="font-medium">
                  {activity.users?.full_name ?? "Usuario"}
                </span>{" "}
                {actionLabels[activity.action] ?? activity.action}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(activity.created_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
