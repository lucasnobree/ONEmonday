"use client";

import { useCurrentSector } from "@/hooks/use-current-sector";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { PriorityChart } from "@/components/dashboard/priority-chart";
import { ColumnDistribution } from "@/components/dashboard/column-distribution";
import { RecentActivity } from "@/components/dashboard/recent-activity";

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-4 h-20"
          >
            <div className="h-3 w-20 bg-muted rounded mb-2" />
            <div className="h-6 w-12 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border bg-card p-6 h-52">
          <div className="h-3 w-32 bg-muted rounded mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-3 bg-muted rounded w-full" />
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-6 h-52">
          <div className="h-3 w-32 bg-muted rounded mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-3 bg-muted rounded w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { currentSector } = useCurrentSector();
  const { data: stats, isLoading } = useDashboardStats(currentSector?.id);

  if (!currentSector) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Selecione um setor no menu lateral para visualizar as metricas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">{currentSector.name}</p>
      </div>

      {isLoading || !stats ? (
        <DashboardSkeleton />
      ) : (
        <>
          <StatsCards stats={stats} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PriorityChart data={stats.cardsByPriority} />
            <ColumnDistribution data={stats.cardsByColumn} />
          </div>
          <RecentActivity sectorId={currentSector.id} />
        </>
      )}
    </div>
  );
}
