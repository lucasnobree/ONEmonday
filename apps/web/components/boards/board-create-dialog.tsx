"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCreateBoard } from "@/hooks/use-boards";
import { useCurrentSector } from "@/hooks/use-current-sector";
import {
  createBoardSchema,
  type CreateBoardInput,
} from "@/lib/validations/boards";
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

interface BoardCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BoardCreateDialog({
  open,
  onOpenChange,
}: BoardCreateDialogProps) {
  const { currentSector } = useCurrentSector();
  const createBoard = useCreateBoard();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateBoardInput>({
    resolver: zodResolver(createBoardSchema),
    defaultValues: {
      visibility: "sector",
      sectorIds: currentSector ? [currentSector.id] : [],
    },
  });

  async function onSubmit(data: CreateBoardInput) {
    if (!currentSector) return;
    const input = { ...data, sectorIds: [currentSector.id] };
    const result = await createBoard.mutateAsync(input);

    if (result.error) {
      toast.error("Erro ao criar board", {
        description: String(result.error),
      });
      return;
    }

    toast.success("Board criado");
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Board</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              placeholder="Ex: Sprint 2026-Q1"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Descreva o propósito deste board"
              {...register("description")}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={createBoard.isPending}>
              {createBoard.isPending ? "Criando..." : "Criar Board"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
