"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateCard } from "@/lib/actions/cards";
import { updateCardSchema } from "@/lib/validations/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import type { Priority } from "@/lib/constants";

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "critical", label: "Critico" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baixa" },
];

interface CardEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    due_date: string | null;
  };
  onSaved: () => void;
}

/**
 * Edits a card's core fields (title, description, priority, due date).
 * Previously the card detail Sheet was entirely read-only — this closes
 * the most fundamental table-stakes gap in the kanban.
 */
export function CardEditDialog({
  open,
  onOpenChange,
  card,
  onSaved,
}: CardEditDialogProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [priority, setPriority] = useState<Priority>(
    card.priority as Priority
  );
  const [dueDate, setDueDate] = useState(card.due_date ?? "");
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  async function handleSave() {
    const payload = {
      id: card.id,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      dueDate: dueDate || null,
    };

    const parsed = updateCardSchema.safeParse(payload);
    if (!parsed.success) {
      const titleIssue = parsed.error.issues.find((i) =>
        i.path.includes("title")
      );
      setTitleError(titleIssue?.message ?? "Dados invalidos");
      return;
    }
    setTitleError(null);

    setSaving(true);
    const result = await updateCard(parsed.data);
    setSaving(false);

    if (result.error) {
      toast.error("Erro ao salvar card", {
        description:
          typeof result.error === "string"
            ? result.error
            : "Verifique os campos",
      });
      return;
    }

    toast.success("Card atualizado");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar card</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="card-title">Titulo</Label>
            <Input
              id="card-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {titleError && (
              <p className="text-sm text-destructive">{titleError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="card-description">Descricao</Label>
            <Textarea
              id="card-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o card"
              className="min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="card-priority">Prioridade</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority((v as Priority) ?? "medium")}
              >
                <SelectTrigger id="card-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="card-due-date">Vencimento</Label>
              <Input
                id="card-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
