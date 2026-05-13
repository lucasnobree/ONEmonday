"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Kanban, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBoards, useDeleteBoard } from "@/hooks/use-boards";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { PermissionGate } from "@/components/shared/permission-gate";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { BoardCreateDialog } from "./board-create-dialog";

export function BoardList() {
  const { currentSector } = useCurrentSector();
  const { data: boards, isLoading } = useBoards(currentSector?.id);
  const deleteBoard = useDeleteBoard();
  const [createOpen, setCreateOpen] = useState(false);

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
      toast.success("Board excluido");
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
            Crie um board para comecar a organizar as tarefas.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards?.map((board: any) => (
            <Card
              key={board.id}
              className="group hover:border-foreground/20 transition-colors"
            >
              <CardHeader>
                <Link
                  href={`/${currentSector.slug}/boards/${board.id}`}
                  className="contents"
                >
                  <CardTitle className="text-base">{board.name}</CardTitle>
                  {board.description && (
                    <CardDescription className="line-clamp-2">
                      {board.description}
                    </CardDescription>
                  )}
                </Link>
                <CardAction>
                  <PermissionGate
                    sectorId={currentSector.id}
                    resource="board"
                    action="delete"
                  >
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
                        <DropdownMenuItem
                          onClick={() => handleDelete(board.id)}
                          variant="destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </PermissionGate>
                </CardAction>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <BoardCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
