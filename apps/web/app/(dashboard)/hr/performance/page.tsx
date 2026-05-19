"use client";

import { useState } from "react";
import Link from "next/link";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useSectorScope } from "@/hooks/use-sector-scope";
import { SectorScopeFilter } from "@/components/shared/sector-scope-filter";
import { sectorFilterValue } from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";
import {
  useReviewCycles,
  useEvaluations,
  useDevelopmentPlans,
  type ReviewCycle,
  type Evaluation,
} from "@/hooks/hr/use-performance";
import { ReviewCycleDialog } from "@/components/hr/review-cycle-dialog";
import { EvaluationDialog } from "@/components/hr/evaluation-dialog";
import { DevelopmentPlanDialog } from "@/components/hr/development-plan-dialog";
import { DevelopmentPlanCard } from "@/components/hr/development-plan-card";
import { NineBoxGrid } from "@/components/hr/nine-box-grid";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Target, Plus } from "lucide-react";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const CYCLE_STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  draft: { label: "Rascunho", variant: "outline" },
  active: { label: "Ativo", variant: "default" },
  closed: { label: "Encerrado", variant: "secondary" },
};

export default function PerformancePage() {
  const { scope } = useSectorScope();
  const { currentSector } = useCurrentSector();
  const { data: cycles, isLoading: cyclesLoading } = useReviewCycles(scope);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  // Creating cycles / evaluations / PDIs needs a concrete target sector;
  // under the all-sectors scope fall back to the sidebar's current sector.
  const createSectorId = sectorFilterValue(scope) ?? currentSector?.id ?? null;

  const activeCycleId =
    selectedCycleId ?? (cycles && cycles.length > 0 ? cycles[0].id : null);

  return (
    <Tabs defaultValue="cycles">
      <div className="flex items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="cycles">Avaliações</TabsTrigger>
          <TabsTrigger value="ninebox">Matriz 9-Box</TabsTrigger>
          <TabsTrigger value="pdi">PDI</TabsTrigger>
        </TabsList>
        <SectorScopeFilter />
      </div>

      <TabsContent value="cycles" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Ciclos</CardTitle>
              {createSectorId && (
                <ReviewCycleDialog sectorId={createSectorId} />
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {cyclesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-12 rounded bg-muted animate-pulse" />
                  ))}
                </div>
              ) : !cycles || cycles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum ciclo de avaliação.
                </p>
              ) : (
                cycles.map((cycle: ReviewCycle) => {
                  const status = CYCLE_STATUS[cycle.status] ?? CYCLE_STATUS.draft;
                  return (
                    <button
                      key={cycle.id}
                      type="button"
                      onClick={() => setSelectedCycleId(cycle.id)}
                      className={`w-full rounded-md border p-2.5 text-left transition-colors ${
                        cycle.id === activeCycleId
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{cycle.name}</span>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {dateFormat.format(new Date(cycle.start_date))} –{" "}
                        {dateFormat.format(new Date(cycle.end_date))} ·{" "}
                        {cycle.evaluation_count} avaliação(ões)
                      </p>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <div className="md:col-span-2">
            <EvaluationsPanel
              cycleId={activeCycleId}
              cycleStatus={
                cycles?.find((c) => c.id === activeCycleId)?.status ?? null
              }
              sectorId={
                cycles?.find((c) => c.id === activeCycleId)?.sector_id ?? null
              }
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="ninebox" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Matriz 9-Box
              {activeCycleId && cycles
                ? ` — ${cycles.find((c) => c.id === activeCycleId)?.name ?? ""}`
                : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NineBoxGrid cycleId={activeCycleId} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="pdi" className="space-y-4">
        <PdiPanel scope={scope} sectorId={createSectorId} />
      </TabsContent>
    </Tabs>
  );
}

function EvaluationsPanel({
  cycleId,
  cycleStatus,
  sectorId,
}: {
  cycleId: string | null;
  cycleStatus: string | null;
  sectorId: string | null;
}) {
  const { data: evaluations, isLoading } = useEvaluations(cycleId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Evaluation | null>(null);

  if (!cycleId) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-sm text-muted-foreground text-center">
            Crie ou selecione um ciclo para registrar avaliações.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Avaliações do ciclo</CardTitle>
        <div className="flex items-center gap-2">
          {cycleStatus === "active" && (
            <Button
              size="sm"
              variant="outline"
              render={
                <Link href={`/hr/performance/${cycleId}/autoavaliacao`} />
              }
            >
              Minha autoavaliação
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nova avaliação
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : !evaluations || evaluations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma avaliação registrada neste ciclo.
          </p>
        ) : (
          <div className="space-y-2">
            {evaluations.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => {
                  setEditing(ev);
                  setDialogOpen(true);
                }}
                className="w-full rounded-md border p-2.5 text-left hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {ev.employee_name}
                  </span>
                  <Badge
                    variant={ev.status === "submitted" ? "default" : "outline"}
                  >
                    {ev.status === "submitted" ? "Concluída" : "Pendente"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {ev.employee_position ?? "—"}
                  {ev.overall_rating != null
                    ? ` · Nota geral ${ev.overall_rating}`
                    : ""}
                  {ev.performance_score != null && ev.potential_score != null
                    ? ` · 9-box ${ev.performance_score}/${ev.potential_score}`
                    : ""}
                </p>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      {sectorId && (
        <EvaluationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          cycleId={cycleId}
          sectorId={sectorId}
          evaluation={editing}
        />
      )}
    </Card>
  );
}

function PdiPanel({
  scope,
  sectorId,
}: {
  scope: SectorScope;
  sectorId: string | null;
}) {
  const { data: plans, isLoading } = useDevelopmentPlans(scope);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {sectorId && <DevelopmentPlanDialog sectorId={sectorId} />}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-48 rounded bg-muted animate-pulse" />
          ))}
        </div>
      ) : !plans || plans.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Target}
              title="Nenhum PDI cadastrado"
              description="Crie planos de desenvolvimento individual para apoiar o crescimento da equipe."
              action={
                sectorId ? (
                  <DevelopmentPlanDialog sectorId={sectorId} />
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <DevelopmentPlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}
