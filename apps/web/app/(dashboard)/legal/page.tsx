"use client";

import Link from "next/link";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useLegalStats } from "@/hooks/legal/use-legal-stats";
import { useContracts } from "@/hooks/legal/use-contracts";
import { useMatters } from "@/hooks/legal/use-matters";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getRenewalStatus,
  needsRenewalAttention,
  daysUntilExpiry,
} from "@/lib/legal/renewal";
import {
  CONTRACT_STATUS_LABELS,
  RENEWAL_STATUS_LABELS,
  MATTER_PRIORITY_LABELS,
} from "@/lib/legal/labels";
import {
  FileText,
  CalendarClock,
  Gavel,
  FilePen,
  BarChart3,
  AlertTriangle,
} from "lucide-react";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

export default function LegalDashboardPage() {
  const { currentSector } = useCurrentSector();
  const { data: stats, isLoading: statsLoading } = useLegalStats(
    currentSector?.id
  );
  const { data: contracts, isLoading: contractsLoading } = useContracts(
    currentSector?.id
  );
  const { data: matters, isLoading: mattersLoading } = useMatters(
    currentSector?.id
  );

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar o Jurídico.
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
    { title: "Contratos Ativos", value: stats?.activeContracts ?? 0, icon: FileText },
    { title: "Vencem em 30 dias", value: stats?.expiring30 ?? 0, icon: CalendarClock },
    { title: "Demandas Abertas", value: stats?.openMatters ?? 0, icon: Gavel },
    { title: "Em Elaboração", value: stats?.draftContracts ?? 0, icon: FilePen },
  ];

  // Contract status distribution.
  const statusCounts: Record<string, number> = {};
  (contracts ?? []).forEach((c) => {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  });
  const maxStatusCount = Math.max(...Object.values(statusCounts), 1);
  const statusEntries = Object.entries(statusCounts).sort(
    ([, a], [, b]) => b - a
  );

  // Contracts that need renewal attention now (notice window open or expired).
  const renewalAlerts = (contracts ?? [])
    .map((c) => ({
      contract: c,
      status: getRenewalStatus(c.expiry_date, c.notice_period_days),
      days: daysUntilExpiry(c.expiry_date),
    }))
    .filter((row) => needsRenewalAttention(row.status))
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

  // Open matters ranked by priority weight.
  const PRIORITY_WEIGHT: Record<string, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const openMatters = (matters ?? [])
    .filter((m) => ["open", "in_progress", "blocked"].includes(m.status))
    .sort(
      (a, b) =>
        (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9)
    )
    .slice(0, 6);

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

      <div className="grid md:grid-cols-2 gap-6">
        {/* Contract status mix */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">
                Contratos por Status
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {contractsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-6 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : statusEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum contrato cadastrado.
              </p>
            ) : (
              <div className="space-y-3">
                {statusEntries.map(([status, count]) => (
                  <div key={status} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {CONTRACT_STATUS_LABELS[status]?.label ?? status}
                      </span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${(count / maxStatusCount) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Renewal alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">
                Renovações que Exigem Ação
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {contractsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-8 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : renewalAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum contrato exige ação de renovação no momento.
              </p>
            ) : (
              <div className="space-y-2">
                {renewalAlerts.slice(0, 6).map(({ contract, status, days }) => {
                  const info = RENEWAL_STATUS_LABELS[status];
                  return (
                    <Link
                      key={contract.id}
                      href="/legal/contracts"
                      className="flex items-center justify-between text-sm hover:bg-muted/50 rounded px-1 -mx-1 py-0.5 transition-colors"
                    >
                      <div className="min-w-0">
                        <span className="font-medium truncate block">
                          {contract.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {contract.counterparty}
                          {contract.expiry_date
                            ? ` - ${dateFormat.format(new Date(contract.expiry_date))}`
                            : ""}
                        </span>
                      </div>
                      <Badge variant={info.variant} className="shrink-0 text-xs">
                        {status === "expired"
                          ? "Vencido"
                          : days != null
                            ? `${days}d`
                            : info.label}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open matters backlog */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gavel className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">
                Demandas Jurídicas Abertas
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {mattersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-8 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : openMatters.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma demanda aberta.
              </p>
            ) : (
              <div className="space-y-2">
                {openMatters.map((matter) => {
                  const priority = MATTER_PRIORITY_LABELS[matter.priority];
                  return (
                    <Link
                      key={matter.id}
                      href="/legal/matters"
                      className="flex items-center justify-between text-sm hover:bg-muted/50 rounded px-1 -mx-1 py-0.5 transition-colors"
                    >
                      <span className="font-medium truncate">
                        {matter.title}
                      </span>
                      <Badge
                        variant={priority?.variant ?? "secondary"}
                        className="shrink-0 text-xs"
                      >
                        {priority?.label ?? matter.priority}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
