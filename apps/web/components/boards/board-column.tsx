"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BoardCard } from "./board-card";
import { createCard } from "@/lib/actions/cards";
import type {
  BoardColumn as BoardColumnType,
  BoardCard as BoardCardType,
} from "@/hooks/use-board-data";

interface BoardColumnProps {
  column: BoardColumnType & { cards: BoardCardType[] };
  boardId: string;
  sectorId: string;
  /** Disables card dragging (used while a board filter is active). */
  dragDisabled?: boolean;
  onCardClick?: (cardId: string) => void;
  onCardCreated?: () => void;
}

export function BoardColumn({
  column,
  boardId,
  sectorId,
  dragDisabled = false,
  onCardClick,
  onCardCreated,
}: BoardColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const cardIds = column.cards.map((c) => c.id);

  const isOverWipLimit =
    column.wip_limit != null && column.cards.length >= column.wip_limit;

  async function handleAddCard() {
    if (!newTitle.trim()) return;
    setIsSubmitting(true);

    const result = await createCard({
      title: newTitle.trim(),
      boardId,
      columnId: column.id,
      sectorId,
      priority: "medium",
    });

    setIsSubmitting(false);

    if (result.error) {
      toast.error("Erro ao criar card", {
        description: String(result.error),
      });
      return;
    }

    setNewTitle("");
    setIsAdding(false);
    onCardCreated?.();
  }

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/50 max-h-[calc(100vh-12rem)]">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: column.color || "#94a3b8" }}
          />
          <span className="text-sm font-medium">{column.name}</span>
          <span className="text-xs text-muted-foreground">
            {column.cards.length}
          </span>
        </div>
        {column.wip_limit != null && (
          <span
            className={cn(
              "text-xs",
              isOverWipLimit
                ? "text-red-500 font-medium"
                : "text-muted-foreground"
            )}
          >
            max {column.wip_limit}
          </span>
        )}
      </div>

      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex-1 space-y-2 overflow-auto px-2 pb-2 min-h-[100px]",
            isOver && "bg-accent/50 rounded-md"
          )}
        >
          {column.cards.map((card) => (
            <BoardCard
              key={card.id}
              card={card}
              dragDisabled={dragDisabled}
              onClick={() => onCardClick?.(card.id)}
            />
          ))}
        </div>
      </SortableContext>

      <div className="px-2 pb-2">
        {isAdding ? (
          <div className="space-y-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Título do card"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCard();
                if (e.key === "Escape") {
                  setIsAdding(false);
                  setNewTitle("");
                }
              }}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddCard}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Criando..." : "Criar"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAdding(false);
                  setNewTitle("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar card
          </Button>
        )}
      </div>
    </div>
  );
}
