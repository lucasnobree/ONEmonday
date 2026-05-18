"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBoardColumnMutations } from "@/hooks/use-board-columns";
import { COLUMN_COLOR_PRESETS } from "@/lib/validations/board-columns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import type { BoardColumn } from "@/hooks/use-board-data";

interface BoardColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  /** Omit to create a new column; pass to edit an existing one. */
  column?: BoardColumn;
}

const DEFAULT_COLOR = COLUMN_COLOR_PRESETS[0].value;

/**
 * Create / edit a board column — name, colour, WIP limit and the
 * "done column" flag. Used by both the "+ Adicionar coluna" affordance and
 * the per-column "Editar" menu item.
 *
 * The form body is a separate component keyed on the column id so it
 * re-mounts (and re-seeds its `useState` from fresh initialisers) every time
 * a different column is opened — no setState-in-effect needed.
 */
export function BoardColumnDialog({
  open,
  onOpenChange,
  boardId,
  column,
}: BoardColumnDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {column ? "Editar coluna" : "Nova coluna"}
          </DialogTitle>
        </DialogHeader>
        {open && (
          <BoardColumnForm
            key={column?.id ?? "new"}
            boardId={boardId}
            column={column}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface BoardColumnFormProps {
  boardId: string;
  column?: BoardColumn;
  onDone: () => void;
}

function BoardColumnForm({ boardId, column, onDone }: BoardColumnFormProps) {
  const { create, update } = useBoardColumnMutations(boardId);
  const isEdit = column != null;

  const [name, setName] = useState(column?.name ?? "");
  const [color, setColor] = useState<string>(column?.color ?? DEFAULT_COLOR);
  const [wipEnabled, setWipEnabled] = useState(column?.wip_limit != null);
  const [wipLimit, setWipLimit] = useState(
    column?.wip_limit != null ? String(column.wip_limit) : ""
  );
  const [isDoneColumn, setIsDoneColumn] = useState(
    column?.is_done_column ?? false
  );
  const [error, setError] = useState<string | null>(null);

  const isPending = create.isPending || update.isPending;

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Nome obrigatório");
      return;
    }

    let wip: number | null = null;
    if (wipEnabled) {
      const parsed = Number(wipLimit);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 999) {
        setError("Limite WIP deve ser um número entre 1 e 999");
        return;
      }
      wip = parsed;
    }

    const result = isEdit
      ? await update.mutateAsync({
          id: column.id,
          name: trimmed,
          color,
          wipLimit: wip,
          isDoneColumn,
        })
      : await create.mutateAsync({
          boardId,
          name: trimmed,
          color,
          wipLimit: wip,
          isDoneColumn,
        });

    if (result.error) {
      toast.error(
        isEdit ? "Erro ao atualizar coluna" : "Erro ao criar coluna",
        { description: String(result.error) }
      );
      return;
    }

    toast.success(isEdit ? "Coluna atualizada" : "Coluna criada");
    onDone();
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="column-name">Nome</Label>
          <Input
            id="column-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Em revisão"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>Cor</Label>
          <div className="flex flex-wrap gap-2">
            {COLUMN_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                aria-label={preset.label}
                aria-pressed={color === preset.value}
                onClick={() => setColor(preset.value)}
                className={cn(
                  "h-7 w-7 rounded-full border-2 transition",
                  color === preset.value
                    ? "border-foreground"
                    : "border-transparent"
                )}
                style={{ backgroundColor: preset.value }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="column-wip-toggle">Limite WIP</Label>
            <p className="text-xs text-muted-foreground">
              Bloqueia novos cards acima do limite.
            </p>
          </div>
          <Switch checked={wipEnabled} onCheckedChange={setWipEnabled} />
        </div>
        {wipEnabled && (
          <Input
            id="column-wip"
            type="number"
            min={1}
            max={999}
            value={wipLimit}
            onChange={(e) => setWipLimit(e.target.value)}
            placeholder="Ex: 5"
          />
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="column-done-toggle">Coluna de conclusão</Label>
            <p className="text-xs text-muted-foreground">
              Cards nesta coluna contam como concluídos.
            </p>
          </div>
          <Switch checked={isDoneColumn} onCheckedChange={setIsDoneColumn} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancelar
        </DialogClose>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </>
  );
}
