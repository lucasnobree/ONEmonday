"use client";

import { useMemo, useState } from "react";
import {
  Kanban,
  LayoutDashboard,
  AlertCircle,
  Handshake,
  Headphones,
  ChevronLeft,
} from "lucide-react";
import { useGlobalOverview } from "@/hooks/use-global-overview";
import { summariseOverview, type SectorOverviewRow } from "@/lib/overview/aggregate";
import { SectorDashboard } from "@/components/dashboard/sector-dashboard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface MetricDef {
  key: keyof Pick<
    SectorOverviewRow,
    | "boardCount"
    | "cardCount"
    | "overdueCardCount"
    | "openDealCount"
    | "openTicketCount"
  >;
  label: string;
  icon: typeof Kanban;
  /** Marks a metric whose non-zero value should read as a warning. */
  warnWhenPositive?: boolean;
}

const SECTOR_METRICS: MetricDef[] = [
  { key: "boardCount", label: "Boards", icon: Kanban },
  { key: "cardCount", label: "Cards", icon: LayoutDashboard },
  {
    key: "overdueCardCount",
    label: "Atrasados",
    icon: AlertCircle,
    warnWhenPositive: true,
  },
  { key: "openDealCount", label: "Negócios abertos", icon: Handshake },
  { key: "openTicketCount", label: "Tickets abertos", icon: Headphones },
];

function TotalsBar({ rows }: { rows: SectorOverviewRow[] }) {
  const totals = useMemo(() => summariseOverview(rows), [rows]);
  const cells = [
    { label: "Setores", value: totals.sectorCount },
    { label: "Boards", value: totals.boardCount },
    { label: "Cards", value: totals.cardCount },
    { label: "Atrasados", value: totals.overdueCardCount },
    { label: "Negócios abertos", value: totals.openDealCount },
    { label: "Tickets abertos", value: totals.openTicketCount },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="text-xs text-muted-foreground">{cell.label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{cell.value}</p>
        </div>
      ))}
    </div>
  );
}

function SectorOverviewCard({
  row,
  onDrillIn,
}: {
  row: SectorOverviewRow;
  onDrillIn: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{row.sectorName}</h3>
        <Button variant="outline" size="sm" onClick={onDrillIn}>
          Ver detalhes
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {SECTOR_METRICS.map((metric) => {
          const Icon = metric.icon;
          const value = row[metric.key];
          const warn = metric.warnWhenPositive && value > 0;
          return (
            <div key={metric.key} className="flex items-center gap-2">
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  warn ? "text-red-500" : "text-muted-foreground"
                }`}
                aria-hidden="true"
              />
              <div>
                <dd
                  className={`text-lg font-semibold tabular-nums ${
                    warn ? "text-red-500" : ""
                  }`}
                >
                  {value}
                </dd>
                <dt className="text-xs text-muted-foreground">
                  {metric.label}
                </dt>
              </div>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-lg" />
      ))}
    </div>
  );
}

export function GlobalOverviewView() {
  const { data: rows, isLoading, error } = useGlobalOverview();
  const [drillSectorId, setDrillSectorId] = useState<string | null>(null);

  const drillSector = useMemo(
    () => (rows ?? []).find((r) => r.sectorId === drillSectorId) ?? null,
    [rows, drillSectorId]
  );

  if (drillSector) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDrillSectorId(null)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Visão Geral
          </Button>
          <h1 className="text-2xl font-bold">{drillSector.sectorName}</h1>
        </div>
        <SectorDashboard sectorId={drillSector.sectorId} showHeading={false} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Visão Geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitoramento de todos os setores. Selecione um setor para ver seus
          gráficos.
        </p>
      </div>

      {isLoading ? (
        <OverviewSkeleton />
      ) : error ? (
        <p className="py-12 text-center text-sm text-destructive">
          Não foi possível carregar a visão geral.
        </p>
      ) : !rows || rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhum setor cadastrado.
        </p>
      ) : (
        <>
          <TotalsBar rows={rows} />
          <div className="space-y-4">
            {rows.map((row) => (
              <SectorOverviewCard
                key={row.sectorId}
                row={row}
                onDrillIn={() => setDrillSectorId(row.sectorId)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
