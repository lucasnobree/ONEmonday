"use client";

import { PRIORITY_CONFIG } from "@/lib/constants";

interface PriorityChartProps {
  data: { priority: string; count: number }[];
}

const priorityBarColors: Record<string, { color: string; bg: string }> = {
  critical: { color: "bg-red-500", bg: "bg-red-500/10" },
  high: { color: "bg-orange-500", bg: "bg-orange-500/10" },
  medium: { color: "bg-yellow-500", bg: "bg-yellow-500/10" },
  low: { color: "bg-green-500", bg: "bg-green-500/10" },
};

export function PriorityChart({ data }: PriorityChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          Cards por Prioridade
        </h3>
        <p className="text-sm text-muted-foreground">Nenhum card encontrado.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">
        Cards por Prioridade
      </h3>
      <div className="space-y-3">
        {data.map((item) => {
          const labelConfig = PRIORITY_CONFIG[item.priority as keyof typeof PRIORITY_CONFIG];
          const barConfig = priorityBarColors[item.priority];
          if (!labelConfig || !barConfig) return null;
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;

          return (
            <div key={item.priority}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{labelConfig.label}</span>
                <span className="text-sm text-muted-foreground">
                  {item.count} ({pct}%)
                </span>
              </div>
              <div className={`h-3 w-full rounded-full ${barConfig.bg}`}>
                <div
                  className={`h-3 rounded-full ${barConfig.color} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
