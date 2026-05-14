"use client";

import { useCurrentSector } from "@/hooks/use-current-sector";
import { useTickets } from "@/hooks/support/use-tickets";
import { useSupportStats } from "@/hooks/support/use-support-stats";
import { PermissionGate } from "@/components/shared/permission-gate";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Ticket,
  AlertCircle,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { SlaAlertBanner } from "@/components/support/sla-alert-banner";

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const priorityLabels: Record<string, string> = {
  critical: "Critica",
  high: "Alta",
  medium: "Media",
  low: "Baixa",
};

export default function SupportDashboardPage() {
  const { currentSector } = useCurrentSector();
  const { data: stats, isLoading: statsLoading } = useSupportStats(
    currentSector?.id
  );
  const { data: tickets, isLoading: ticketsLoading } = useTickets(
    currentSector?.id
  );

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar o Support Desk.
      </p>
    );
  }

  const statCards = [
    {
      title: "Total Tickets",
      value: stats?.totalTickets ?? 0,
      icon: Ticket,
    },
    {
      title: "Abertos",
      value: stats?.openTickets ?? 0,
      icon: AlertCircle,
    },
    {
      title: "SLA Violados",
      value: stats?.slaBreached ?? 0,
      icon: ShieldAlert,
    },
    {
      title: "Resolvidos",
      value: stats?.resolvedTickets ?? 0,
      icon: CheckCircle2,
    },
  ];

  return (
    <PermissionGate
      sectorId={currentSector.id}
      resource="ticket"
      action="read"
      fallback={
        <p className="text-muted-foreground">
          Voce nao tem permissao para acessar o Support Desk deste setor.
        </p>
      }
    >
      <div className="space-y-6">
        <SlaAlertBanner />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    {statsLoading ? (
                      <Skeleton className="mt-1 h-8 w-16" />
                    ) : (
                      <p className="text-2xl font-bold">{stat.value}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tickets Recentes</CardTitle>
            <CardDescription>
              Ultimos tickets abertos neste setor
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ticketsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !tickets?.length ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum ticket encontrado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Titulo</th>
                      <th className="pb-2 font-medium">Prioridade</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Categoria</th>
                      <th className="pb-2 font-medium">Criado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.slice(0, 10).map((ticket: any) => (
                      <tr
                        key={ticket.id}
                        className="border-b last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-3 pr-4 font-medium">
                          {ticket.card?.title || "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant="secondary"
                            className={
                              priorityColors[ticket.card?.priority] || ""
                            }
                          >
                            {priorityLabels[ticket.card?.priority] ||
                              ticket.card?.priority}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          {ticket.resolved_at ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              Resolvido
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Aberto</Badge>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {ticket.category || "—"}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleDateString(
                            "pt-BR"
                          )}
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
    </PermissionGate>
  );
}
