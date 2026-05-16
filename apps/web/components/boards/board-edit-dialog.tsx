"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useUpdateBoard } from "@/hooks/use-boards";
import type { BoardSummary } from "@/hooks/use-boards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { z } from "zod";

const editBoardSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(100),
  description: z.string().max(500).optional(),
});

type EditBoardFormInput = z.infer<typeof editBoardSchema>;

interface BoardEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: BoardSummary;
}

/**
 * Edits a board's name and description. The `useUpdateBoard` mutation
 * already existed but had no UI entry point.
 */
export function BoardEditDialog({
  open,
  onOpenChange,
  board,
}: BoardEditDialogProps) {
  const updateBoard = useUpdateBoard();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditBoardFormInput>({
    resolver: zodResolver(editBoardSchema),
    defaultValues: {
      name: board.name,
      description: board.description ?? "",
    },
  });

  // Re-seed the form whenever a different board is opened.
  useEffect(() => {
    if (open) {
      reset({ name: board.name, description: board.description ?? "" });
    }
  }, [open, board.id, board.name, board.description, reset]);

  async function onSubmit(data: EditBoardFormInput) {
    const result = await updateBoard.mutateAsync({
      id: board.id,
      name: data.name,
      description: data.description || undefined,
      visibility: board.visibility as
        | "sector"
        | "cross_sector"
        | "global",
    });

    if (result.error) {
      toast.error("Erro ao atualizar board", {
        description: String(result.error),
      });
      return;
    }

    toast.success("Board atualizado");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Board</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-board-name">Nome</Label>
            <Input
              id="edit-board-name"
              placeholder="Ex: Sprint 2026-Q1"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-board-description">Descrição (opcional)</Label>
            <Textarea
              id="edit-board-description"
              placeholder="Descreva o propósito deste board"
              {...register("description")}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={updateBoard.isPending}>
              {updateBoard.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
