"use client";

import { useCurrentSector } from "@/hooks/use-current-sector";
import { useHRStats } from "@/hooks/hr/use-hr-stats";
import { useTimeOffRequests } from "@/hooks/hr/use-time-off-requests";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, UserMinus, Clock, Briefcase } from "lucide-react";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
};

export default function HRDashboardPage() {
  const { currentSector } = useCurrentSector();
  const { data: stats, isLoading: statsLoading } = useHRStats(currentSector?.id);
  const { data: timeOffRequests, isLoading: timeOffLoading } = useTimeOffRequests(currentSector?.id);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar o RH.
      </p>
    );
  }

  if (statsLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-muted" />
      </div>
    );
  }

  const statCards = [
    {
      title: "Colaboradores",
      value: stats?.totalEmployees ?? 0,
      icon: Users,
    },
    {
      title: "Em Licenca",
      value: stats?.onLeave ?? 0,
      icon: UserMinus,
    },
    {
      title: "Solicitacoes Pendentes",
      value: stats?.pendingRequests ?? 0,
      icon: Clock,
    },
    {
      title: "Vagas Abertas",
      value: stats?.openPositions ?? 0,
      icon: Briefcase,
    },
  ];

  const upcomingTimeOff = (timeOffRequests ?? [])
    .filter((r) => r.status === "approved" && new Date(r.start_date) >= new Date())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <card.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold">{card.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proximas Ferias</CardTitle>
          <CardDescription>
            Colaboradores com ferias aprovadas nos proximos dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timeOffLoading ? (
            <div className="animate-pulse space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 rounded bg-muted" />
              ))}
            </div>
          ) : upcomingTimeOff.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma ferias programada.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Colaborador</th>
                    <th className="pb-2 font-medium">Periodo</th>
                    <th className="pb-2 font-medium">Dias</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingTimeOff.map((req) => {
                    const statusInfo = STATUS_MAP[req.status] ?? {
                      label: req.status,
                      variant: "secondary" as const,
                    };
                    return (
                      <tr key={req.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">
                          {req.hr_employees.full_name}
                        </td>
                        <td className="py-2">
                          {dateFormat.format(new Date(req.start_date))} -{" "}
                          {dateFormat.format(new Date(req.end_date))}
                        </td>
                        <td className="py-2">{req.days_count}</td>
                        <td className="py-2">
                          <Badge variant={statusInfo.variant}>
                            {statusInfo.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
