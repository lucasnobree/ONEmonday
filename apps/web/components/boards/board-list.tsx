"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Kanban,
  MoreHorizontal,
  Trash2,
  Pencil,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useBoards, useDeleteBoard } from "@/hooks/use-boards";
import type { BoardSummary } from "@/hooks/use-boards";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { PermissionGate } from "@/components/shared/permission-gate";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BoardCreateDialog } from "./board-create-dialog";
import { BoardEditDialog } from "./board-edit-dialog";
import { sortBoards, filterBoards, type BoardSortKey } from "./board-sort";

const SORT_OPTIONS: { value: BoardSortKey; label: string }[] = [
  { value: "recent", label: "Atualizados recentemente" },
  { value: "name", label: "Nome (A-Z)" },
  { value: "created", label: "Criados recentemente" },
];

const VISIBILITY_LABELS: Record<string, string> = {
  cross_sector: "Multi-setor",
  global: "Global",
};

export function BoardList() {
  const { currentSector } = useCurrentSector();
  const { data: boards, isLoading } = useBoards(currentSector?.id);
  const deleteBoard = useDeleteBoard();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<BoardSummary | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<BoardSortKey>("recent");

  const visibleBoards = useMemo(
    () => (boards ? sortBoards(filterBoards(boards, search), sort) : []),
    [boards, search, sort]
  );

  if (!currentSector) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Kanban className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h2 className="text-lg font-medium">Selecione um setor</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha um setor no menu lateral para ver seus boards.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    );
  }

  async function handleDelete(boardId: string) {
    const result = await deleteBoard.mutateAsync(boardId);
    if (result.error) {
      toast.error("Erro ao excluir board", {
        description: String(result.error),
      });
    } else {
      toast.success("Board excluído");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Boards</h1>
          <p className="text-sm text-muted-foreground">{currentSector.name}</p>
        </div>
        <PermissionGate
          sectorId={currentSector.id}
          resource="board"
          action="create"
        >
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Board
          </Button>
        </PermissionGate>
      </div>

      {boards && boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Kanban className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-medium">Nenhum board</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Crie um board para começar a organizar as tarefas.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-50">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar boards por nome..."
                className="pl-8"
                aria-label="Buscar boards"
              />
            </div>
            <Select
              value={sort}
              onValueChange={(v) => v && setSort(v as BoardSortKey)}
            >
              <SelectTrigger className="w-56" aria-label="Ordenar boards">
                <SelectValue>
                  {SORT_OPTIONS.find((opt) => opt.value === sort)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {visibleBoards.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum board corresponde à busca.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleBoards.map((board) => (
                <Card
                  key={board.id}
                  className="group hover:border-foreground/20 transition-colors"
                >
                  <CardHeader>
                    <Link
                      href={`/${currentSector.slug}/boards/${board.id}`}
                      className="contents"
                    >
                      <CardTitle className="text-base">
                        {board.name}
                      </CardTitle>
                      {board.description && (
                        <CardDescription className="line-clamp-2">
                          {board.description}
                        </CardDescription>
                      )}
                    </Link>
                    {VISIBILITY_LABELS[board.visibility] && (
                      <Badge variant="secondary" className="mt-2 w-fit">
                        {VISIBILITY_LABELS[board.visibility]}
                      </Badge>
                    )}
                    <CardAction>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 group-hover:opacity-100"
                        />
                      }
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <PermissionGate
                        sectorId={currentSector.id}
                        resource="board"
                        action="update"
                      >
                        <DropdownMenuItem
                          onClick={() => setEditingBoard(board)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                      </PermissionGate>
                      <PermissionGate
                        sectorId={currentSector.id}
                        resource="board"
                        action="delete"
                      >
                        <ConfirmDialog
                          title="Excluir board"
                          description={`Tem certeza que deseja excluir "${board.name}"? Esta ação não pode ser desfeita.`}
                          variant="destructive"
                          onConfirm={() => handleDelete(board.id)}
                        >
                          <DropdownMenuItem
                            variant="destructive"
                            closeOnClick={false}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </ConfirmDialog>
                      </PermissionGate>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardAction>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <BoardCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editingBoard && (
        <BoardEditDialog
          open={editingBoard !== null}
          onOpenChange={(open) => {
            if (!open) setEditingBoard(null);
          }}
          board={editingBoard}
        />
      )}
    </div>
  );
}
