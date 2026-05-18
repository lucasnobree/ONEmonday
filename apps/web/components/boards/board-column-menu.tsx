"use client";

import { useState } from "react";
import {
  MoreHorizontal,
  Pencil,
  ArrowLeft,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useBoardColumnMutations } from "@/hooks/use-board-columns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { BoardColumnDialog } from "./board-column-dialog";
import { moveColumn } from "./board-columns-util";
import type { BoardColumn } from "@/hooks/use-board-data";

interface BoardColumnMenuProps {
  boardId: string;
  column: BoardColumn;
  /** Every column id on the board, in current position order. */
  orderedColumnIds: string[];
}

/**
 * The per-column `⋯` menu: edit (name/colour/WIP/done), move left/right and
 * delete. Reorder uses discrete move actions rather than drag — they are
 * fully keyboard-accessible and map cleanly onto `reorder_board_columns`.
 */
export function BoardColumnMenu({
  boardId,
  column,
  orderedColumnIds,
}: BoardColumnMenuProps) {
  const { reorder, remove } = useBoardColumnMutations(boardId);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const index = orderedColumnIds.indexOf(column.id);
  const canMoveLeft = index > 0;
  const canMoveRight = index >= 0 && index < orderedColumnIds.length - 1;

  async function handleMove(direction: -1 | 1) {
    const next = moveColumn(orderedColumnIds, column.id, direction);
    if (!next) return;
    const result = await reorder.mutateAsync({ boardId, columnIds: next });
    if (result.error) {
      toast.error("Erro ao mover coluna", {
        description: String(result.error),
      });
    }
  }

  async function handleDelete() {
    const result = await remove.mutateAsync(column.id);
    if (result.error) {
      toast.error("Erro ao excluir coluna", {
        description: String(result.error),
      });
      return;
    }
    toast.success("Coluna excluída");
    setConfirmOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Opções da coluna ${column.name}`}
            />
          }
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Editar coluna
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canMoveLeft || reorder.isPending}
            onClick={() => handleMove(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            Mover para a esquerda
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canMoveRight || reorder.isPending}
            onClick={() => handleMove(1)}
          >
            <ArrowRight className="h-4 w-4" />
            Mover para a direita
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Excluir coluna
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <BoardColumnDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        boardId={boardId}
        column={column}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir coluna?</DialogTitle>
            <DialogDescription>
              A coluna &quot;{column.name}&quot; será removida. Só é possível
              excluir colunas sem cards.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={remove.isPending}
            >
              {remove.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
