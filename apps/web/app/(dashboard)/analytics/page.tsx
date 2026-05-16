"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  DollarSign,
  Headphones,
  Kanban,
  Plus,
  Target,
  Users,
} from "lucide-react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useAnalyticsOverview } from "@/hooks/analytics/use-analytics-overview";
import { useReports, type AnalyticsReport } from "@/hooks/analytics/use-reports";
import {
  DEFAULT_RANGE,
  rangeToDays,
  type RangePreset,
} from "@/lib/analytics/date-range";
import { formatMetricValue } from "@/lib/analytics/kpi";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeFilter } from "@/components/analytics/date-range-filter";
import { KpiCard } from "@/components/analytics/kpi-card";
import { ReportCard } from "@/components/analytics/report-card";
import { ReportFormDialog } from "@/components/analytics/report-form-dialog";

const count = (value: number) => formatMetricValue(value, "count");
const currency = (value: number) => formatMetricValue(value, "currency_cents");

export default function AnalyticsPage() {
  const { currentSector } = useCurrentSector();
  const [range, setRange] = useState<RangePreset>(DEFAULT_RANGE);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AnalyticsReport | undefined>();

  const sectorId = currentSector?.id;
  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview(
    sectorId,
    rangeToDays(range)
  );
  const { data: reports, isLoading: reportsLoading } = useReports(sectorId);

  if (!currentSector) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Selecione um setor no menu lateral para visualizar as métricas.
        </p>
      </div>
    );
  }

  const openReportDialog = (report?: AnalyticsReport) => {
    setEditing(report);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">{currentSector.name}</p>
        </div>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {overviewLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : overview ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label="Cards Concluídos"
              value={count(overview.cards_completed_current)}
              icon={CheckCircle2}
              iconColor="text-emerald-500"
              current={overview.cards_completed_current}
              previous={overview.cards_completed_previous}
            />
            <KpiCard
              label="Valor de Negócios Ganhos"
              value={currency(overview.deals_won_value_cents_current)}
              icon={DollarSign}
              iconColor="text-green-500"
              current={overview.deals_won_value_cents_current}
              previous={overview.deals_won_value_cents_previous}
            />
            <KpiCard
              label="Tickets Resolvidos"
              value={count(overview.tickets_resolved_current)}
              icon={Headphones}
              iconColor="text-sky-500"
              current={overview.tickets_resolved_current}
              previous={overview.tickets_resolved_previous}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <KpiCard
              label="Cards Abertos"
              value={count(overview.cards_open)}
              icon={Kanban}
              iconColor="text-indigo-500"
            />
            <KpiCard
              label="Negócios Abertos"
              value={count(overview.deals_open)}
              icon={Target}
              iconColor="text-violet-500"
            />
            <KpiCard
              label="Tickets Abertos"
              value={count(overview.tickets_open)}
              icon={Headphones}
              iconColor="text-amber-500"
            />
            <KpiCard
              label="SLA Violados"
              value={count(overview.sla_breaches_current)}
              icon={AlertTriangle}
              iconColor="text-red-500"
            />
            <KpiCard
              label="Colaboradores"
              value={count(overview.headcount_active)}
              icon={Users}
              iconColor="text-pink-500"
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar as métricas deste setor.
        </p>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Relatórios Salvos</h2>
          <Button size="sm" onClick={() => openReportDialog()}>
            <Plus className="mr-1 h-4 w-4" />
            Novo Relatório
          </Button>
        </div>

        {reportsLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        ) : reports && reports.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                sectorId={currentSector.id}
                onEdit={openReportDialog}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum relatório salvo. Crie o primeiro para acompanhar uma
              métrica ao longo do tempo.
            </p>
          </div>
        )}
      </div>

      <ReportFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sectorId={currentSector.id}
        report={editing}
      />
    </div>
  );
}
