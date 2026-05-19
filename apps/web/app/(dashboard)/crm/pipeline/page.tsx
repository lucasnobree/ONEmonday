"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useSectorScope } from "@/hooks/use-sector-scope";
import { SectorScopeFilter } from "@/components/shared/sector-scope-filter";
import { isScopeReady, sectorFilterValue } from "@/lib/navigation/scoped-query";
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
import { useCrmMembers } from "@/hooks/crm/use-crm-members";
import { DealCreateDialog } from "@/components/crm/deal-create-dialog";
import { DealDetailSheet } from "@/components/crm/deal-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Plus,
  Kanban,
  Building2,
  CalendarDays,
  GripVertical,
  AlertTriangle,
  Search,
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
  const { scope, isLoading: scopeLoading } = useSectorScope();
  const { currentSector } = useCurrentSector();
  // The deal list honours the on-screen scope (a concrete sector filters by
  // `sector_id`; the all-sectors sentinel skips that filter). The pipeline's
  // board/stage/owner lookups and the create dialog are single-sector by
  // contract, so they fall back to the sidebar's current sector under the
  // all-sectors scope.
  const effectiveSectorId =
    sectorFilterValue(scope) ?? currentSector?.id ?? null;
  const { data: deals, isLoading: dealsLoading } = useDeals(scope);
  const { data: stageDefaults } = useStageDefaults(
    effectiveSectorId ?? undefined
  );
  const { data: boards, isLoading: boardsLoading } = useBoards(
    effectiveSectorId ?? undefined
  );
  const { data: members } = useCrmMembers(effectiveSectorId ?? undefined);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("open");
  const [search, setSearch] = useState("");
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

  const filteredDeals = useMemo(() => {
    let result = deals ?? [];
    // status: open hides closed deals; won/lost narrow to outcome.
    if (statusFilter === "open") {
      result = result.filter((d) => !d.actual_close_date);
    } else if (statusFilter === "won") {
      result = result.filter((d) => d.actual_close_date && !d.lost_reason);
    } else if (statusFilter === "lost") {
      result = result.filter((d) => d.actual_close_date && d.lost_reason);
    }
    if (ownerFilter !== "all") {
      result = result.filter((d) => d.owner_id === ownerFilter);
    }
    if (priorityFilter !== "all") {
      result = result.filter((d) => d.card?.priority === priorityFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.card?.title?.toLowerCase().includes(q) ||
          d.company?.name?.toLowerCase().includes(q) ||
          d.contact?.full_name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [deals, statusFilter, ownerFilter, priorityFilter, search]);

  if (isScopeReady(scope) && !effectiveSectorId) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para acessar o pipeline.
      </p>
    );
  }

  const isLoading = scopeLoading || dealsLoading || boardsLoading;

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

  const stages = buildStageColumns(filteredDeals);

  const totalPipelineValue = filteredDeals.reduce(
    (sum, d) => sum + (d.value || 0),
    0
  );

  const hasActiveFilter =
    ownerFilter !== "all" ||
    priorityFilter !== "all" ||
    statusFilter !== "open" ||
    search.trim() !== "";

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold">Pipeline de Vendas</h2>
          <p className="text-sm text-muted-foreground">
            {filteredDeals.length} deals &middot;{" "}
            {formatCurrency(totalPipelineValue)} no pipeline
          </p>
        </div>
        {crmBoard && (
          <Button
            onClick={() => setShowCreateDeal(true)}
            disabled={!effectiveSectorId}
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo Deal
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <SectorScopeFilter />
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar deals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Select value={ownerFilter} onValueChange={(v) => setOwnerFilter(v ?? "all")}>
          <SelectTrigger className="h-8 w-44 text-sm">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos responsáveis</SelectItem>
            {(members || []).map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={priorityFilter}
          onValueChange={(v) => setPriorityFilter(v ?? "all")}
        >
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda prioridade</SelectItem>
            <SelectItem value="critical">Crítica</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v ?? "open")}
        >
          <SelectTrigger className="h-8 w-32 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Abertos</SelectItem>
            <SelectItem value="won">Ganhos</SelectItem>
            <SelectItem value="lost">Perdidos</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setOwnerFilter("all");
              setPriorityFilter("all");
              setStatusFilter("open");
              setSearch("");
            }}
          >
            Limpar filtros
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

      {crmBoard && effectiveSectorId && (
        <DealCreateDialog
          open={showCreateDeal}
          onOpenChange={setShowCreateDeal}
          sectorId={effectiveSectorId}
          boardId={crmBoard.id}
        />
      )}

      {effectiveSectorId && (
        <DealDetailSheet
          dealId={selectedDealId}
          sectorId={effectiveSectorId}
          open={!!selectedDealId}
          onOpenChange={(o) => !o && setSelectedDealId(null)}
        />
      )}
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

      {/* Deal owner */}
      <div className="flex items-center justify-end mt-2">
        {deal.owner ? (
          <div
            className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary"
            title={`Responsável: ${deal.owner.full_name}`}
          >
            {deal.owner.full_name
              .split(" ")
              .map((n) => n[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
        ) : (
          <div
            className="h-6 w-6 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center text-[10px] text-muted-foreground"
            title="Sem responsável"
          >
            ?
          </div>
        )}
      </div>
    </div>
  );
}
