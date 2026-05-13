"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { escalateCard } from "@/lib/actions/escalation";
import type { EscalateCardInput } from "@/lib/validations/escalation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EscalateDialogProps {
  cardId: string;
  cardTitle: string;
  currentSectorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REFERENCE_TYPES = [
  { value: "escalation", label: "Escalacao" },
  { value: "related", label: "Relacionado" },
  { value: "blocks", label: "Bloqueia" },
  { value: "blocked_by", label: "Bloqueado por" },
] as const;

export function EscalateDialog({
  cardId,
  cardTitle,
  currentSectorId,
  open,
  onOpenChange,
}: EscalateDialogProps) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [targetSectorId, setTargetSectorId] = useState("");
  const [targetBoardId, setTargetBoardId] = useState("");
  const [referenceType, setReferenceType] = useState("");
  const [note, setNote] = useState("");

  const sectorsQuery = useQuery({
    queryKey: ["sectors", currentSectorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sectors")
        .select("id, name, slug")
        .eq("is_active", true)
        .neq("id", currentSectorId);

      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const boardsQuery = useQuery({
    queryKey: ["boards", targetSectorId],
    queryFn: async () => {
      if (!targetSectorId) return [];

      const { data, error } = await supabase
        .from("board_sectors")
        .select(
          `
          board_id,
          boards!inner (
            id, name, is_active
          )
        `
        )
        .eq("sector_id", targetSectorId)
        .eq("boards.is_active", true);

      if (error) throw error;
      return data?.map((bs) => bs.boards).flat() ?? [];
    },
    enabled: !!targetSectorId,
  });

  const mutation = useMutation({
    mutationFn: (input: EscalateCardInput) => escalateCard(input),
    onSuccess: (result) => {
      if (result.error) {
        toast.error("Erro ao escalar card", {
          description: String(result.error),
        });
        return;
      }

      toast.success("Card escalado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["card-detail", cardId] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erro ao escalar card", {
        description: error.message,
      });
    },
  });

  function resetForm() {
    setTargetSectorId("");
    setTargetBoardId("");
    setReferenceType("");
    setNote("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!targetSectorId || !targetBoardId || !referenceType) return;

    mutation.mutate({
      sourceCardId: cardId,
      targetSectorId,
      targetBoardId,
      referenceType: referenceType as EscalateCardInput["referenceType"],
      note: note || undefined,
    });
  }

  function handleSectorChange(value: string | null) {
    setTargetSectorId(value ?? "");
    setTargetBoardId("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escalar Card</DialogTitle>
          <DialogDescription>
            Escalar &quot;{cardTitle}&quot; para outro setor.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Setor destino</Label>
            <Select value={targetSectorId} onValueChange={handleSectorChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o setor" />
              </SelectTrigger>
              <SelectContent>
                {sectorsQuery.data?.map((sector) => (
                  <SelectItem key={sector.id} value={sector.id}>
                    {sector.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Board destino</Label>
            <Select value={targetBoardId} onValueChange={(v) => setTargetBoardId(v ?? "")}>
              <SelectTrigger className="w-full" disabled={!targetSectorId}>
                <SelectValue placeholder="Selecione o board" />
              </SelectTrigger>
              <SelectContent>
                {boardsQuery.data?.map((board) => (
                  <SelectItem key={board.id} value={board.id}>
                    {board.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de referencia</Label>
            <Select value={referenceType} onValueChange={(v) => setReferenceType(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {REFERENCE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="escalation-note">Nota (opcional)</Label>
            <Textarea
              id="escalation-note"
              placeholder="Adicione uma nota sobre esta escalacao..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                !targetSectorId ||
                !targetBoardId ||
                !referenceType
              }
            >
              {mutation.isPending ? "Escalando..." : "Escalar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
