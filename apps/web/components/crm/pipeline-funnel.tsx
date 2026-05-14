"use client";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

interface FunnelStage {
  stage: string;
  count: number;
  value: number;
}

interface PipelineFunnelProps {
  stages: FunnelStage[];
}

export function PipelineFunnel({ stages }: PipelineFunnelProps) {
  if (!stages.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Nenhum dado de pipeline disponivel.
      </p>
    );
  }

  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="space-y-2">
      {stages.map((stage) => {
        const widthPct = Math.max((stage.count / maxCount) * 100, 8);
        return (
          <div key={stage.stage} className="space-y-0.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate max-w-[200px]">
                {stage.stage}
              </span>
              <span className="text-muted-foreground text-xs">
                {stage.count} {stage.count === 1 ? "deal" : "deals"} ·{" "}
                {formatCurrency(stage.value)}
              </span>
            </div>
            <div className="h-6 w-full bg-muted rounded-md overflow-hidden">
              <div
                className="h-full bg-primary/80 rounded-md flex items-center px-2 transition-all"
                style={{ width: `${widthPct}%` }}
              >
                <span className="text-xs font-medium text-primary-foreground truncate">
                  {stage.count}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
