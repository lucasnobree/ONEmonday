"use client";

import { useCurrentSector } from "@/hooks/use-current-sector";
import { useDeals } from "@/hooks/crm/use-deals";
import { useCRMStats } from "@/hooks/crm/use-crm-stats";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Users,
} from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const priorityLabels: Record<string, string> = {
  critical: "Critica",
  high: "Alta",
  medium: "Media",
  low: "Baixa",
};

const priorityVariants: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

export default function CRMDashboardPage() {
  const { currentSector } = useCurrentSector();
  const { data: deals, isLoading: dealsLoading } = useDeals(currentSector?.id);
  const { data: stats, isLoading: statsLoading } = useCRMStats(currentSector?.id);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar o CRM.
      </p>
    );
  }

  const isLoading = dealsLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  const statCards = [
    {
      title: "Deals Ativos",
      value: String(stats?.activeDeals ?? 0),
      icon: DollarSign,
    },
    {
      title: "Valor no Pipeline",
      value: formatCurrency(stats?.pipelineValue ?? 0),
      icon: TrendingUp,
    },
    {
      title: "Deals Ganhos",
      value: String(stats?.wonDeals ?? 0),
      icon: CheckCircle2,
    },
    {
      title: "Contatos",
      value: String(stats?.totalContacts ?? 0),
      icon: Users,
    },
  ];

  const recentDeals = (deals || []).slice(0, 10);

  return (
    <div className="space-y-6">
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
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deals Recentes</CardTitle>
          <CardDescription>Ultimos deals criados no pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          {recentDeals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum deal encontrado. Crie seu primeiro deal no Pipeline.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Titulo</th>
                    <th className="pb-2 font-medium">Empresa</th>
                    <th className="pb-2 font-medium">Valor</th>
                    <th className="pb-2 font-medium">Probabilidade</th>
                    <th className="pb-2 font-medium">Estagio</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDeals.map((deal) => (
                    <tr key={deal.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">
                        {deal.card?.title ?? "—"}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {deal.company?.name ?? "—"}
                      </td>
                      <td className="py-3">
                        {deal.value != null ? formatCurrency(deal.value) : "—"}
                      </td>
                      <td className="py-3">
                        {deal.win_probability != null
                          ? `${deal.win_probability}%`
                          : "—"}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={
                            priorityVariants[deal.card?.priority ?? "medium"] ??
                            "secondary"
                          }
                        >
                          {deal.card?.board_columns?.name ?? "—"}
                        </Badge>
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
  );
}
