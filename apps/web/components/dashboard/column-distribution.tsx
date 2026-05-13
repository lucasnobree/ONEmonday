"use client";

interface ColumnDistributionProps {
  data: { column_name: string; column_color: string; count: number }[];
}

export function ColumnDistribution({ data }: ColumnDistributionProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          Distribuicao por Coluna
        </h3>
        <p className="text-sm text-muted-foreground">Nenhum card encontrado.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">
        Distribuicao por Coluna
      </h3>
      <div className="space-y-3">
        {data.map((item) => {
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;

          return (
            <div key={item.column_name}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: item.column_color }}
                  />
                  <span className="text-sm font-medium">
                    {item.column_name}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {item.count}
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-muted">
                <div
                  className="h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: item.column_color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
