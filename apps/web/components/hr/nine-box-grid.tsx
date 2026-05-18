"use client";

import { useNineBoxGrid, type NineBoxEntry } from "@/hooks/hr/use-performance";
import { nineBoxCell } from "@/lib/hr/performance";
import { Badge } from "@/components/ui/badge";

// Cell background tones, keyed by `performance-potential`. The cell *label*
// comes from the shared, unit-tested `nineBoxCell` helper.
const CELL_TONES: Record<string, string> = {
  "1-1": "bg-red-50 border-red-200",
  "2-1": "bg-orange-50 border-orange-200",
  "3-1": "bg-amber-50 border-amber-200",
  "1-2": "bg-orange-50 border-orange-200",
  "2-2": "bg-yellow-50 border-yellow-200",
  "3-2": "bg-lime-50 border-lime-200",
  "1-3": "bg-amber-50 border-amber-200",
  "2-3": "bg-lime-50 border-lime-200",
  "3-3": "bg-green-50 border-green-200",
};

interface NineBoxGridProps {
  cycleId: string | null;
}

export function NineBoxGrid({ cycleId }: NineBoxGridProps) {
  const { data, isLoading } = useNineBoxGrid(cycleId);

  if (!cycleId) {
    return (
      <p className="text-sm text-muted-foreground">
        Selecione um ciclo para ver a matriz 9-box.
      </p>
    );
  }

  if (isLoading) {
    return <div className="h-72 rounded bg-muted animate-pulse" />;
  }

  const entries = data ?? [];

  function cellEntries(performance: number, potential: number): NineBoxEntry[] {
    return entries.filter(
      (e) => e.performance_score === performance && e.potential_score === potential
    );
  }

  // Potential rows from 3 (top) to 1 (bottom).
  const potentialRows = [3, 2, 1];
  const performanceCols = [1, 2, 3];

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Eixo horizontal: desempenho · Eixo vertical: potencial ·{" "}
        {entries.length} colaborador(es) posicionado(s)
      </p>
      <div className="grid grid-cols-3 gap-2">
        {potentialRows.map((potential) =>
          performanceCols.map((performance) => {
            const key = `${performance}-${potential}`;
            const meta = nineBoxCell(performance, potential);
            const cell = cellEntries(performance, potential);
            return (
              <div
                key={key}
                className={`min-h-[110px] rounded-lg border p-2 ${CELL_TONES[key]}`}
              >
                <p className="text-[11px] font-semibold text-foreground/70">
                  {meta?.label}
                </p>
                <div className="mt-1 space-y-1">
                  {cell.map((e) => (
                    <Badge
                      key={e.evaluation_id}
                      variant="secondary"
                      className="block w-full truncate text-left text-[11px]"
                    >
                      {e.employee_name}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
