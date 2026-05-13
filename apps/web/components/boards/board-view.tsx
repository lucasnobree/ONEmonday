"use client";

import { useState, useCallback } from "react";
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
import { reorderCards } from "@/lib/actions/cards";
import { BoardColumn } from "./board-column";
import { BoardCard } from "./board-card";
import { Skeleton } from "@/components/ui/skeleton";

interface BoardViewProps {
  boardId: string;
  sectorId: string;
}

export function BoardView({ boardId, sectorId }: BoardViewProps) {
  const { data: board, isLoading, error } = useBoardData(boardId);
  const queryClient = useQueryClient();
  const [activeCard, setActiveCard] = useState<BoardCardType | null>(null);

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
      if (!over || !board) return;

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
    [board, boardId, queryClient]
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {board.columns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              boardId={boardId}
              sectorId={sectorId}
              onCardCreated={() =>
                queryClient.invalidateQueries({
                  queryKey: ["board", boardId],
                })
              }
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? <BoardCard card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
