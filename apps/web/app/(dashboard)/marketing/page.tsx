"use client";

import { useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useMarketingSummary } from "@/hooks/marketing/use-marketing-summary";
import { useCampaigns } from "@/hooks/marketing/use-campaigns";
import {
  SpendByChannelChart,
  LeadsByChannelChart,
} from "@/components/marketing/channel-charts";
import { formatCents } from "@/lib/finance/money";
import {
  conversionRate,
  budgetUsagePercent,
} from "@/lib/marketing/metrics";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_VARIANTS,
  CHANNEL_LABELS,
} from "@/lib/marketing/labels";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Wallet, Users, Target } from "lucide-react";

export default function MarketingDashboardPage() {
  const { currentSector } = useCurrentSector();
  const { data: summary, isLoading: summaryLoading } = useMarketingSummary(
    currentSector?.id
  );
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns(
    currentSector?.id
  );

  const convRate = useMemo(() => {
    if (!summary) return 0;
    return conversionRate(summary.total_conversions, summary.total_leads);
  }, [summary]);

  const budgetUsage = useMemo(() => {
    if (!summary) return 0;
    return budgetUsagePercent(
      summary.total_spend_cents,
      summary.total_budget_cents
    );
  }, [summary]);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar o Marketing.
      </p>
    );
  }

  const isLoading = summaryLoading || campaignsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-72 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  const statCards = [
    {
      title: "Campanhas Ativas",
      value: String(summary?.active_campaigns ?? 0),
      icon: Megaphone,
      tone: "text-violet-500",
      hint: `${summary?.total_campaigns ?? 0} no total`,
    },
    {
      title: "Gasto / Orcamento",
      value: formatCents(summary?.total_spend_cents ?? 0),
      icon: Wallet,
      tone: budgetUsage > 100 ? "text-red-500" : "text-emerald-500",
      hint: `${budgetUsage}% de ${formatCents(
        summary?.total_budget_cents ?? 0
      )}`,
    },
    {
      title: "Leads Gerados",
      value: (summary?.total_leads ?? 0).toLocaleString("pt-BR"),
      icon: Users,
      tone: "text-blue-500",
    },
    {
      title: "Taxa de Conversao",
      value: `${convRate}%`,
      icon: Target,
      tone: "text-emerald-500",
      hint: `${(summary?.total_conversions ?? 0).toLocaleString(
        "pt-BR"
      )} conversoes`,
    },
  ];

  const recentCampaigns = (campaigns ?? []).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <stat.icon className={`h-5 w-5 ${stat.tone}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-xl font-bold truncate" title={stat.value}>
                    {stat.value}
                  </p>
                  {stat.hint && (
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      {stat.hint}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gasto por Canal</CardTitle>
            <CardDescription>
              Distribuicao do investimento de marketing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SpendByChannelChart data={summary?.by_channel ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Leads e Conversoes por Canal
            </CardTitle>
            <CardDescription>
              Desempenho de geracao de demanda
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeadsByChannelChart data={summary?.by_channel ?? []} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campanhas Recentes</CardTitle>
          <CardDescription>Ultimas campanhas registradas</CardDescription>
        </CardHeader>
        <CardContent>
          {recentCampaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma campanha registrada. Crie a primeira em Campanhas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Campanha</th>
                    <th className="pb-2 font-medium">Canal</th>
                    <th className="pb-2 font-medium">Gasto</th>
                    <th className="pb-2 font-medium">Leads</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCampaigns.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{c.name}</td>
                      <td className="py-3 text-muted-foreground">
                        {CHANNEL_LABELS[c.channel]}
                      </td>
                      <td className="py-3">
                        {formatCents(c.spend_cents)}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {c.leads.toLocaleString("pt-BR")}
                      </td>
                      <td className="py-3">
                        <Badge variant={CAMPAIGN_STATUS_VARIANTS[c.status]}>
                          {CAMPAIGN_STATUS_LABELS[c.status]}
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
