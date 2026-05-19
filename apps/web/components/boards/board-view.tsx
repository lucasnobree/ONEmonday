"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useBoardData,
  type BoardCard as BoardCardType,
  type BoardData,
} from "@/hooks/use-board-data";
import { useRealtimeBoard } from "@/hooks/use-realtime-board";
import { usePermissions } from "@/hooks/use-permissions";
import { reorderCards, createCard } from "@/lib/actions/cards";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BoardColumn } from "./board-column";
import { BoardCard } from "./board-card";
import { BoardLaneScroll } from "./board-lane-scroll";
import { isWipLimitReached, wipLimitMessage } from "./board-wip";
import { BoardCardDetail } from "./board-card-detail";
import { BoardListView } from "./board-list-view";
import { BoardTimelineView } from "./board-timeline-view";
import {
  BoardFilters,
  EMPTY_BOARD_FILTERS,
  applyBoardFilters,
  countBoardCards,
  isBoardFiltered,
  type BoardFilterState,
  type BoardGroupBy,
} from "./board-filters";
import {
  buildSwimlanes,
  collectAssigneeOptions,
  collectTagOptions,
} from "./board-grouping";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { BoardColumnDialog } from "./board-column-dialog";

interface BoardViewProps {
  boardId: string;
  sectorId: string;
}

export function BoardView({ boardId, sectorId }: BoardViewProps) {
  const { data: board, isLoading, error } = useBoardData(boardId);
  useRealtimeBoard(boardId);
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [activeCard, setActiveCard] = useState<BoardCardType | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [filters, setFilters] = useState<BoardFilterState>(
    EMPTY_BOARD_FILTERS
  );
  const [groupBy, setGroupBy] = useState<BoardGroupBy>("column");

  // Column management is gated on the `board_column` capability and only
  // offered in the ungrouped Kanban view, where every column is shown once.
  const canManageColumns = hasPermission(
    sectorId,
    "board_column",
    "update"
  );

  // Reordering is disabled while a filter is active OR while the board is
  // grouped into swimlanes — in both cases a lane only ever holds a partial
  // card set, so positions cannot be safely recomputed from it.
  const isFiltered = isBoardFiltered(filters);
  const dragDisabled = isFiltered || groupBy !== "column";

  const filteredBoard = useMemo(
    () => (board ? applyBoardFilters(board, filters) : board),
    [board, filters]
  );

  const assigneeOptions = useMemo(
    () => (board ? collectAssigneeOptions(board) : []),
    [board]
  );
  const tagOptions = useMemo(
    () => (board ? collectTagOptions(board) : []),
    [board]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // `+ New Item` (board-level): creates a card in the first column and opens
  // its detail panel so the user can name/fill it inline — mirrors Monday's
  // far-left primary creation action.
  const handleNewItem = useCallback(async () => {
    if (!board || board.columns.length === 0 || isCreatingItem) return;
    setIsCreatingItem(true);
    const firstColumn = board.columns[0];
    const result = await createCard({
      title: "Novo item",
      boardId,
      columnId: firstColumn.id,
      sectorId,
      priority: "medium",
    });
    setIsCreatingItem(false);

    if (result.error || !result.data) {
      toast.error("Erro ao criar item", {
        description:
          typeof result.error === "string" ? result.error : undefined,
      });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    setSelectedCardId(result.data.id);
  }, [board, boardId, sectorId, queryClient, isCreatingItem]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      if (!board) return;
      for (const col of board.columns) {
        const card = col.cards.find((c) => c.id === active.id);
        if (card) {
          setActiveCard(card);
          break;
        }
      }
    },
    [board]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveCard(null);
      // Reordering is disabled while a filter is active or the board is
      // grouped, so positions are never recomputed from a partial card set.
      if (!over || !board || dragDisabled) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Find source column and card
      const sourceCol = board.columns.find((col) =>
        col.cards.some((c) => c.id === activeId)
      );
      if (!sourceCol) return;

      // Find target column (could be dropping on a card or directly on column)
      let targetCol = board.columns.find((col) => col.id === overId);
      if (!targetCol) {
        targetCol = board.columns.find((col) =>
          col.cards.some((c) => c.id === overId)
        );
      }
      if (!targetCol) return;

      // Build new card positions for target column
      const movedCard = sourceCol.cards.find((c) => c.id === activeId);
      if (!movedCard) return;

      // Enforce the target column's WIP limit on a cross-column move. A
      // same-column reorder never changes a column's card count, so it is
      // always allowed.
      if (
        targetCol.id !== sourceCol.id &&
        isWipLimitReached({
          wip_limit: targetCol.wip_limit,
          cardCount: targetCol.cards.length,
        })
      ) {
        toast.warning(wipLimitMessage(targetCol.wip_limit as number));
        return;
      }

      // Remove card from source and compute target cards
      let targetCards: BoardCardType[];
      if (targetCol.id === sourceCol.id) {
        // Same column reorder
        targetCards = targetCol.cards.filter((c) => c.id !== activeId);
      } else {
        // Cross-column move
        targetCards = [...targetCol.cards];
      }

      // Find insert index
      const overIndex = targetCards.findIndex((c) => c.id === overId);
      const insertIndex = overIndex >= 0 ? overIndex : targetCards.length;
      targetCards.splice(insertIndex, 0, movedCard);

      const cardPositions = targetCards.map((card, index) => ({
        card_id: card.id,
        position: index,
      }));

      // Optimistic update
      queryClient.setQueryData(
        ["board", boardId],
        (old: BoardData | undefined) => {
          if (!old) return old;
          return {
            ...old,
            columns: old.columns.map((col) => {
              if (col.id === sourceCol.id && col.id !== targetCol!.id) {
                return {
                  ...col,
                  cards: col.cards.filter((c) => c.id !== activeId),
                };
              }
              if (col.id === targetCol!.id) {
                const allCards =
                  sourceCol.id === targetCol!.id
                    ? sourceCol.cards
                    : [...sourceCol.cards, ...targetCol!.cards];
                return {
                  ...col,
                  cards: cardPositions
                    .map((cp) => {
                      const card = allCards.find(
                        (c) => c.id === cp.card_id
                      );
                      return card
                        ? {
                            ...card,
                            position: cp.position,
                            column_id: targetCol!.id,
                          }
                        : null;
                    })
                    .filter(Boolean) as BoardCardType[],
                };
              }
              return col;
            }),
          };
        }
      );

      // Server call
      const result = await reorderCards({
        boardId,
        columnId: targetCol.id,
        cardPositions,
        expectedBoardUpdatedAt: board.updated_at,
      });

      if (result.error) {
        if (result.error === "conflict") {
          toast.info("Conflito detectado", {
            description:
              "O board foi atualizado por outro usuario. Recarregando...",
          });
        } else {
          toast.error("Erro ao mover card");
        }
        queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      }
    },
    [board, boardId, queryClient, dragDisabled]
  );

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto p-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Erro ao carregar board.</p>
      </div>
    );
  }

  const viewBoard = filteredBoard ?? board;
  const swimlanes = buildSwimlanes(viewBoard, groupBy);

  // The full, unfiltered column ordering — the reorder RPC needs every id.
  const orderedColumnIds = board.columns.map((c) => c.id);
  // Column management is only safe in the single-lane "Coluna" view: while
  // grouped, the same column id appears in several lanes.
  const showColumnMenus = canManageColumns && groupBy === "column";

  // The column the dragged card belongs to — drives the drag-overlay pill.
  const activeCardColumn = activeCard
    ? board.columns.find((c) => c.id === activeCard.column_id)
    : undefined;

  return (
    <div>
      <Tabs defaultValue={0}>
        {/* Sticky two-row board header — Monday "new board design" model. */}
        <div className="sticky top-0 z-20 -mx-1 mb-4 border-b border-border bg-background px-1">
          {/* Row 1 — identity + view tabs */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold">{board.name}</h1>
              {board.description && (
                <p className="truncate text-xs text-muted-foreground">
                  {board.description}
                </p>
              )}
            </div>
            <TabsList variant="line" className="h-8">
              <TabsTrigger value={0}>Kanban</TabsTrigger>
              <TabsTrigger value={1}>Lista</TabsTrigger>
              <TabsTrigger value={2}>Timeline</TabsTrigger>
            </TabsList>
          </div>

          {/* Row 2 — actions: New Item far-left, filter cluster right */}
          <div className="flex flex-wrap items-center gap-2 pb-3">
            <Button
              onClick={handleNewItem}
              disabled={isCreatingItem || board.columns.length === 0}
            >
              <Plus className="h-4 w-4" />
              {isCreatingItem ? "Criando..." : "Novo item"}
            </Button>
            <div className="ml-auto flex flex-1 flex-wrap items-center justify-end gap-2">
              <BoardFilters
                filters={filters}
                onChange={setFilters}
                groupBy={groupBy}
                onGroupByChange={setGroupBy}
                assigneeOptions={assigneeOptions}
                tagOptions={tagOptions}
                resultCount={countBoardCards(viewBoard)}
              />
            </div>
          </div>
        </div>

        <TabsContent value={0}>
          {dragDisabled && (
            <p className="mb-3 text-xs text-muted-foreground">
              {groupBy !== "column"
                ? "Reordenar cards está desativado enquanto o board está agrupado."
                : "Reordenar cards está desativado enquanto um filtro está ativo."}
            </p>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-4">
              {swimlanes.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum card para exibir.
                </p>
              ) : (
                swimlanes.map((lane) => (
                  <div key={lane.id}>
                    {lane.label && (
                      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                        {lane.label}
                      </h3>
                    )}
                    <BoardLaneScroll>
                      {lane.board.columns.map((column) => (
                        <BoardColumn
                          key={`${lane.id}-${column.id}`}
                          column={column}
                          boardId={boardId}
                          sectorId={sectorId}
                          dragDisabled={dragDisabled}
                          canManageColumns={showColumnMenus}
                          orderedColumnIds={orderedColumnIds}
                          onCardClick={(cardId) => setSelectedCardId(cardId)}
                          onCardCreated={() =>
                            queryClient.invalidateQueries({
                              queryKey: ["board", boardId],
                            })
                          }
                        />
                      ))}
                      {showColumnMenus && (
                        <button
                          type="button"
                          onClick={() => setAddColumnOpen(true)}
                          className="flex w-12 shrink-0 items-center justify-center self-start rounded-lg border border-dashed border-border bg-muted/30 py-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label="Adicionar coluna"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                    </BoardLaneScroll>
                  </div>
                ))
              )}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeCard ? (
                <div className="rotate-2 scale-105 shadow-xl opacity-90">
                  <BoardCard
                    card={activeCard}
                    statusLabel={activeCardColumn?.name}
                    statusColor={activeCardColumn?.color}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </TabsContent>

        <TabsContent value={1}>
          <BoardListView
            board={viewBoard}
            onCardClick={(cardId) => setSelectedCardId(cardId)}
          />
        </TabsContent>

        <TabsContent value={2}>
          <BoardTimelineView
            board={viewBoard}
            onCardClick={(cardId) => setSelectedCardId(cardId)}
          />
        </TabsContent>
      </Tabs>

      <BoardCardDetail
        cardId={selectedCardId}
        open={!!selectedCardId}
        onOpenChange={(open) => {
          if (!open) setSelectedCardId(null);
        }}
        boardId={boardId}
        sectorId={sectorId}
      />

      <BoardColumnDialog
        open={addColumnOpen}
        onOpenChange={setAddColumnOpen}
        boardId={boardId}
      />
    </div>
  );
}
