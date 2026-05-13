"use client";

interface PriorityChartProps {
  data: { priority: string; count: number }[];
}

const priorityConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  critical: { label: "Critico", color: "bg-red-500", bg: "bg-red-500/10" },
  high: { label: "Alta", color: "bg-orange-500", bg: "bg-orange-500/10" },
  medium: { label: "Media", color: "bg-blue-500", bg: "bg-blue-500/10" },
  low: { label: "Baixa", color: "bg-slate-400", bg: "bg-slate-400/10" },
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
          const config = priorityConfig[item.priority];
          if (!config) return null;
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;

          return (
            <div key={item.priority}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{config.label}</span>
                <span className="text-sm text-muted-foreground">
                  {item.count} ({pct}%)
                </span>
              </div>
              <div className={`h-3 w-full rounded-full ${config.bg}`}>
                <div
                  className={`h-3 rounded-full ${config.color} transition-all duration-500`}
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
