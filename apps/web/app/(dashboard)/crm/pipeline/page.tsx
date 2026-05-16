"use client";

import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useDeals, type Deal } from "@/hooks/crm/use-deals";
import { buildStageColumns } from "@/lib/crm/pipeline-stages";
import {
  useStageDefaults,
  toRottingConfig,
} from "@/hooks/crm/use-stage-defaults";
import { useBoards } from "@/hooks/use-boards";
import { moveDealToColumn } from "@/lib/actions/crm/move-deal";
import {
  getDealRotting,
  rottingLabel,
  type RottingConfig,
} from "@/lib/crm/deal-rotting";
import { DealCreateDialog } from "@/components/crm/deal-create-dialog";
import { DealDetailSheet } from "@/components/crm/deal-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Plus,
  Kanban,
  Building2,
  CalendarDays,
  GripVertical,
  AlertTriangle,
} from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const priorityColors: Record<string, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-yellow-500",
  low: "border-l-slate-400",
};

const probabilityVariant = (prob: number | null) => {
  if (prob == null) return "secondary";
  if (prob >= 70) return "default";
  if (prob >= 40) return "secondary";
  return "outline";
};

export default function PipelinePage() {
  const { currentSector } = useCurrentSector();
  const { data: deals, isLoading: dealsLoading } = useDeals(currentSector?.id);
  const { data: stageDefaults } = useStageDefaults(currentSector?.id);
  const { data: boards, isLoading: boardsLoading } = useBoards(
    currentSector?.id
  );
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const dragDataRef = useRef<{ dealId: string; sourceColumnId: string } | null>(
    null
  );
  const queryClient = useQueryClient();

  const handleDragStart = useCallback(
    (e: React.DragEvent, deal: Deal) => {
      if (isMoving) return;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", deal.id);
      dragDataRef.current = {
        dealId: deal.id,
        sourceColumnId: deal.card.column_id,
      };
      setDraggingDealId(deal.id);
    },
    [isMoving]
  );

  const handleDragEnd = useCallback(() => {
    setDraggingDealId(null);
    setDragOverColumnId(null);
    dragDataRef.current = null;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, columnId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOverColumnId !== columnId) {
        setDragOverColumnId(columnId);
      }
    },
    [dragOverColumnId]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent, columnId: string) => {
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      const currentTarget = e.currentTarget as HTMLElement;
      if (relatedTarget && currentTarget.contains(relatedTarget)) return;
      if (dragOverColumnId === columnId) {
        setDragOverColumnId(null);
      }
    },
    [dragOverColumnId]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetColumnId: string) => {
      e.preventDefault();
      setDragOverColumnId(null);
      setDraggingDealId(null);

      const dragData = dragDataRef.current;
      dragDataRef.current = null;

      if (!dragData) return;
      if (dragData.sourceColumnId === targetColumnId) return;

      setIsMoving(true);
      try {
        const result = await moveDealToColumn({
          dealId: dragData.dealId,
          columnId: targetColumnId,
        });

        if (result.error) {
          console.error("Erro ao mover deal:", result.error);
        }

        await queryClient.invalidateQueries({ queryKey: ["crm-deals"] });
        await queryClient.invalidateQueries({ queryKey: ["crm-stats"] });
      } catch (err) {
        console.error("Erro ao mover deal:", err);
      } finally {
        setIsMoving(false);
      }
    },
    [queryClient]
  );

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar o pipeline.
      </p>
    );
  }

  const isLoading = dealsLoading || boardsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 rounded-lg bg-muted animate-pulse" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="min-w-70 space-y-3">
              <div className="h-20 rounded-xl bg-muted animate-pulse" />
              <div className="h-32 rounded-xl bg-muted animate-pulse" />
              <div className="h-32 rounded-xl bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const rottingConfig: RottingConfig = toRottingConfig(stageDefaults);

  const crmBoard = (boards || []).find((b) => {
    const name = (b.name ?? "").toLowerCase();
    return (
      name.includes("crm") ||
      name.includes("pipeline") ||
      name.includes("vendas")
    );
  });

  if (!crmBoard && (!deals || deals.length === 0)) {
    return (
      <EmptyState
        icon={Kanban}
        title="Nenhum pipeline encontrado"
        description='Crie um board com nome "CRM", "Pipeline" ou "Vendas" na seção de Boards para começar a usar o pipeline de vendas.'
      />
    );
  }

  const stages = buildStageColumns(deals || []);

  const totalPipelineValue = (deals || []).reduce(
    (sum, d) => sum + (d.value || 0),
    0
  );

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold">Pipeline de Vendas</h2>
          <p className="text-sm text-muted-foreground">
            {deals?.length ?? 0} deals &middot;{" "}
            {formatCurrency(totalPipelineValue)} no pipeline
          </p>
        </div>
        {crmBoard && (
          <Button onClick={() => setShowCreateDeal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Deal
          </Button>
        )}
      </div>

      {stages.length === 0 ? (
        <EmptyState
          icon={Kanban}
          title="Nenhum deal no pipeline"
          description="Adicione seu primeiro deal para começar a acompanhar suas vendas."
          action={
            crmBoard ? (
              <Button onClick={() => setShowCreateDeal(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Novo Deal
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto flex gap-4 pb-4 flex-1 min-h-0">
          {stages.map((stage) => {
            const stageTotal = stage.deals.reduce(
              (sum, d) => sum + (d.value || 0),
              0
            );
            const isOver = dragOverColumnId === stage.columnId;

            return (
              <div
                key={stage.columnId}
                className={`min-w-70 w-75 shrink-0 flex flex-col rounded-xl transition-colors ${
                  isOver
                    ? "bg-accent/60 ring-2 ring-primary/30"
                    : "bg-muted/40"
                }`}
                onDragOver={(e) => handleDragOver(e, stage.columnId)}
                onDragLeave={(e) => handleDragLeave(e, stage.columnId)}
                onDrop={(e) => handleDrop(e, stage.columnId)}
              >
                {/* Column Header */}
                <div className="p-3 shrink-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: stage.stageColor }}
                    />
                    <span className="font-semibold text-sm truncate">
                      {stage.stageName}
                    </span>
                    <Badge variant="secondary" className="ml-auto shrink-0">
                      {stage.deals.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(stageTotal)} &middot; {stage.deals.length}{" "}
                    {stage.deals.length === 1 ? "deal" : "deals"}
                  </p>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                  {stage.deals.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      rottingConfig={rottingConfig}
                      isDragging={draggingDealId === deal.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      disabled={isMoving}
                      onClick={() => setSelectedDealId(deal.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {crmBoard && (
        <DealCreateDialog
          open={showCreateDeal}
          onOpenChange={setShowCreateDeal}
          sectorId={currentSector.id}
          boardId={crmBoard.id}
        />
      )}

      <DealDetailSheet
        dealId={selectedDealId}
        sectorId={currentSector.id}
        open={!!selectedDealId}
        onOpenChange={(o) => !o && setSelectedDealId(null)}
      />
    </div>
  );
}

function DealCard({
  deal,
  rottingConfig,
  isDragging,
  onDragStart,
  onDragEnd,
  disabled,
  onClick,
}: {
  deal: Deal;
  rottingConfig: RottingConfig;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, deal: Deal) => void;
  onDragEnd: () => void;
  disabled: boolean;
  onClick: () => void;
}) {
  const priority = deal.card?.priority ?? "low";
  const borderClass = priorityColors[priority] ?? priorityColors.low;

  const rotting = getDealRotting(
    deal.card?.board_columns?.name,
    deal.last_stage_change_at,
    rottingConfig
  );
  const rottingText = rottingLabel(rotting);

  return (
    <div
      draggable={!disabled}
      onDragStart={(e) => onDragStart(e, deal)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group rounded-lg border border-l-[3px] bg-background p-3 cursor-grab active:cursor-grabbing transition-all ${borderClass} ${
        rotting.isRotting ? "ring-1 ring-red-300 dark:ring-red-900" : ""
      } ${
        isDragging
          ? "opacity-40 scale-95 shadow-none"
          : "hover:shadow-md"
      }`}
    >
      {/* Drag handle + Title */}
      <div className="flex items-start gap-1.5">
        <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="font-medium text-sm leading-snug line-clamp-2 flex-1">
          {deal.card?.title ?? "Sem titulo"}
        </span>
      </div>

      {/* Rotting badge */}
      {rottingText && (
        <div
          className="mt-2 inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-400"
          title={`Sem movimentação há ${rotting.idleDays} dias (limite do estágio: ${rotting.thresholdDays})`}
        >
          <AlertTriangle className="h-3 w-3" />
          {rottingText}
        </div>
      )}

      {/* Value */}
      {deal.value != null && (
        <p className="text-sm font-semibold text-foreground mt-2">
          {formatCurrency(deal.value)}
        </p>
      )}

      {/* Company */}
      {deal.company?.name && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{deal.company.name}</span>
        </div>
      )}

      {/* Footer: date + probability */}
      <div className="flex items-center justify-between mt-2 gap-2">
        {deal.expected_close_date ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3 shrink-0" />
            <span>
              {new Date(deal.expected_close_date).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              })}
            </span>
          </div>
        ) : (
          <span />
        )}

        {deal.win_probability != null && (
          <Badge
            variant={probabilityVariant(deal.win_probability)}
            className="text-[10px] px-1.5 py-0"
          >
            {deal.win_probability}%
          </Badge>
        )}
      </div>

      {/* Owner placeholder */}
      <div className="flex items-center justify-end mt-2">
        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
          {(deal.contact?.full_name ?? deal.company?.name ?? "?")
            .charAt(0)
            .toUpperCase()}
        </div>
      </div>
    </div>
  );
}
