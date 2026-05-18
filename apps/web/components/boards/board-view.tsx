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
import { reorderCards } from "@/lib/actions/cards";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BoardColumn } from "./board-column";
import { BoardCard } from "./board-card";
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

interface BoardViewProps {
  boardId: string;
  sectorId: string;
}

export function BoardView({ boardId, sectorId }: BoardViewProps) {
  const { data: board, isLoading, error } = useBoardData(boardId);
  useRealtimeBoard(boardId);
  const queryClient = useQueryClient();
  const [activeCard, setActiveCard] = useState<BoardCardType | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [filters, setFilters] = useState<BoardFilterState>(
    EMPTY_BOARD_FILTERS
  );
  const [groupBy, setGroupBy] = useState<BoardGroupBy>("column");

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

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{board.name}</h1>
        {board.description && (
          <p className="text-sm text-muted-foreground mt-1">
            {board.description}
          </p>
        )}
      </div>

      <Tabs defaultValue={0}>
        <TabsList className="mb-4">
          <TabsTrigger value={0}>Kanban</TabsTrigger>
          <TabsTrigger value={1}>Lista</TabsTrigger>
          <TabsTrigger value={2}>Timeline</TabsTrigger>
        </TabsList>

        <BoardFilters
          filters={filters}
          onChange={setFilters}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          assigneeOptions={assigneeOptions}
          tagOptions={tagOptions}
          resultCount={countBoardCards(viewBoard)}
        />

        <TabsContent value={0}>
          {dragDisabled && (
            <p className="mb-3 text-xs text-muted-foreground">
              {groupBy !== "column"
                ? "Reordenar cards esta desativado enquanto o board esta agrupado."
                : "Reordenar cards esta desativado enquanto um filtro esta ativo."}
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
                    <div className="flex gap-4 overflow-x-auto pb-4">
                      {lane.board.columns.map((column) => (
                        <BoardColumn
                          key={`${lane.id}-${column.id}`}
                          column={column}
                          boardId={boardId}
                          sectorId={sectorId}
                          dragDisabled={dragDisabled}
                          onCardClick={(cardId) => setSelectedCardId(cardId)}
                          onCardCreated={() =>
                            queryClient.invalidateQueries({
                              queryKey: ["board", boardId],
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeCard ? (
                <div className="rotate-2 scale-105 shadow-xl opacity-90">
                  <BoardCard card={activeCard} />
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
    </div>
  );
}
