"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createTicket } from "@/lib/actions/support/tickets";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Plus } from "lucide-react";

interface TicketCreateDialogProps {
  sectorId: string;
  boardId: string;
  columnId: string;
  onCreated?: () => void;
}

const PRIORITIES = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

const CATEGORIES = [
  "Suporte Tecnico",
  "Financeiro",
  "Comercial",
  "RH",
  "Infraestrutura",
  "Outros",
];

const CHANNELS = [
  { value: "internal", label: "Interno" },
  { value: "email", label: "Email" },
  { value: "chat", label: "Chat" },
  { value: "phone", label: "Telefone" },
];

export function TicketCreateDialog({
  sectorId,
  boardId,
  columnId,
  onCreated,
}: TicketCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("");
  const [channel, setChannel] = useState("internal");

  function resetForm() {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setCategory("");
    setChannel("internal");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const result = await createTicket({
      sectorId,
      boardId,
      columnId,
      title,
      description: description || undefined,
      priority,
      category,
      channel,
    });

    setSubmitting(false);

    if (result.error) {
      const msg =
        typeof result.error === "string"
          ? result.error
          : "Verifique os campos e tente novamente.";
      toast.error(msg);
      return;
    }

    toast.success("Ticket criado com sucesso");
    resetForm();
    setOpen(false);
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        Novo Ticket
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo Ticket</DialogTitle>
            <DialogDescription>
              Preencha os dados para abrir um novo ticket de suporte.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-title">Título</Label>
              <Input
                id="ticket-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Descreva o problema brevemente"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticket-description">Descrição</Label>
              <Textarea
                id="ticket-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes adicionais..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v ?? "medium")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value) =>
                        PRIORITIES.find((p) => p.value === value)?.label ??
                        "Selecione"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Canal</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v ?? "internal")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value) =>
                        CHANNELS.find((c) => c.value === value)?.label ??
                        "Selecione"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting || !title || !category}>
              {submitting ? "Criando..." : "Criar Ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
