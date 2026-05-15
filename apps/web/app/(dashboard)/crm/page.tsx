"use client";

import { useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useDeals } from "@/hooks/crm/use-deals";
import { useCRMStats } from "@/hooks/crm/use-crm-stats";
import { PipelineFunnel } from "@/components/crm/pipeline-funnel";
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
  Target,
  Trophy,
  Clock,
} from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

/** Compact two-letter initials for an avatar placeholder. */
const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function CRMDashboardPage() {
  const { currentSector } = useCurrentSector();
  const { data: deals, isLoading: dealsLoading } = useDeals(currentSector?.id);
  const { data: stats, isLoading: statsLoading } = useCRMStats(currentSector?.id);

  const pipelineStages = useMemo(() => {
    if (!deals) return [];
    const openDeals = deals.filter((d) => !d.actual_close_date);
    const stageMap = new Map<string, { count: number; value: number }>();
    for (const deal of openDeals) {
      const stage = deal.card?.board_columns?.name ?? "Sem estagio";
      const existing = stageMap.get(stage) ?? { count: 0, value: 0 };
      existing.count += 1;
      existing.value += Number(deal.value) || 0;
      stageMap.set(stage, existing);
    }
    return Array.from(stageMap.entries()).map(([stage, data]) => ({
      stage,
      count: data.count,
      value: data.value,
    }));
  }, [deals]);

  // Weighted pipeline forecast: sum of (value x win_probability) across
  // open deals. Best-practice forecasting signal alongside raw pipeline value.
  const weightedPipeline = useMemo(() => {
    if (!deals) return 0;
    return deals
      .filter((d) => !d.actual_close_date)
      .reduce((sum, d) => {
        const value = Number(d.value) || 0;
        const prob = d.win_probability ?? 0;
        return sum + (value * prob) / 100;
      }, 0);
  }, [deals]);

  // Top performers: ranked by total value of WON deals, grouped by the deal
  // creator (cards.created_by -> users). crm_deals has no owner_id, so the
  // card creator is the canonical "owner" of the deal.
  const topPerformers = useMemo(() => {
    if (!deals) return [];
    const wonDeals = deals.filter((d) => d.actual_close_date && !d.lost_reason);
    const performerMap = new Map<string, { name: string; total: number }>();
    for (const deal of wonDeals) {
      const creatorId = deal.card?.created_by;
      if (!creatorId) continue;
      const name = deal.card?.users?.full_name ?? "Usuario";
      const existing = performerMap.get(creatorId) ?? { name, total: 0 };
      existing.total += Number(deal.value) || 0;
      performerMap.set(creatorId, existing);
    }
    return Array.from(performerMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [deals]);

  const closingSoon = useMemo(() => {
    if (!deals) return [];
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return deals
      .filter((d) => {
        if (d.actual_close_date) return false;
        if (!d.expected_close_date) return false;
        const closeDate = new Date(d.expected_close_date);
        return closeDate >= now && closeDate <= sevenDays;
      })
      .map((d) => {
        const closeDate = new Date(d.expected_close_date!);
        const daysLeft = Math.ceil(
          (closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          id: d.id,
          title: d.card?.title ?? "—",
          company: d.company?.name ?? "—",
          value: d.value,
          daysLeft,
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 10);
  }, [deals]);

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
      title: "Previsao Ponderada",
      value: formatCurrency(weightedPipeline),
      icon: Target,
      hint: "Soma de valor x probabilidade dos deals abertos",
    },
    {
      title: "Deals Ganhos",
      value: String(stats?.wonDeals ?? 0),
      icon: CheckCircle2,
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
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold truncate" title={stat.value}>
                    {stat.value}
                  </p>
                  {"hint" in stat && stat.hint && (
                    <p className="text-[11px] text-muted-foreground/80 leading-tight">
                      {stat.hint}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funil de Pipeline</CardTitle>
            <CardDescription>
              Distribuicao de deals por estagio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PipelineFunnel stages={pipelineStages} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Fechamento Proximo</CardTitle>
            </div>
            <CardDescription>
              Deals com fechamento nos proximos 7 dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            {closingSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum deal com fechamento proximo.
              </p>
            ) : (
              <div className="space-y-3">
                {closingSoon.map((deal) => (
                  <div
                    key={deal.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {deal.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {deal.company}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-medium">
                        {deal.value != null ? formatCurrency(deal.value) : "—"}
                      </span>
                      <Badge
                        variant={deal.daysLeft <= 2 ? "destructive" : "secondary"}
                      >
                        {deal.daysLeft === 0
                          ? "Hoje"
                          : deal.daysLeft === 1
                            ? "Amanha"
                            : `${deal.daysLeft}d`}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {topPerformers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-base">Top Performers</CardTitle>
            </div>
            <CardDescription>
              Ranking por valor total de deals ganhos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPerformers.map((performer, index) => (
                <div
                  key={`${performer.name}-${index}`}
                  className="flex items-center gap-3"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0">
                    {initials(performer.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {performer.name}
                    </p>
                  </div>
                  <span className="text-sm font-semibold shrink-0">
                    {formatCurrency(performer.total)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                        {deal.card?.board_columns ? (
                          <Badge
                            variant="secondary"
                            style={{
                              backgroundColor:
                                deal.card.board_columns.color + "20",
                              color: deal.card.board_columns.color,
                            }}
                          >
                            {deal.card.board_columns.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
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
  );
}
