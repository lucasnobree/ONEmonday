"use client";

import { useState } from "react";
import { useCreateDeal } from "@/hooks/crm/use-deals";
import { useCompanies } from "@/hooks/crm/use-companies";
import { useContacts } from "@/hooks/crm/use-contacts";
import { useBoardData } from "@/hooks/use-board-data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { toast } from "sonner";

interface DealCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  boardId: string;
}

export function DealCreateDialog({
  open,
  onOpenChange,
  sectorId,
  boardId,
}: DealCreateDialogProps) {
  const createDeal = useCreateDeal();
  const { data: board } = useBoardData(boardId);
  const { data: companies } = useCompanies(sectorId);
  const { data: contacts } = useContacts(sectorId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columnId, setColumnId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [value, setValue] = useState("");
  const [probability, setProbability] = useState("");
  const [priority, setPriority] = useState("medium");

  const columns = board?.columns ?? [];

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setColumnId("");
    setCompanyId("");
    setContactId("");
    setValue("");
    setProbability("");
    setPriority("medium");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedColumnId = columnId || columns[0]?.id;
    if (!selectedColumnId) {
      toast.error("Nenhuma coluna disponível no board");
      return;
    }

    const result = await createDeal.mutateAsync({
      sectorId,
      boardId,
      columnId: selectedColumnId,
      title,
      description: description || undefined,
      priority,
      companyId: companyId || undefined,
      contactId: contactId || undefined,
      value: value ? parseFloat(value) : undefined,
      winProbability: probability ? parseInt(probability, 10) : undefined,
    });

    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao criar deal"
      );
      return;
    }

    toast.success("Deal criado com sucesso");
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo Deal</DialogTitle>
            <DialogDescription>
              Crie um novo deal no pipeline de vendas
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="deal-title">Título</Label>
              <Input
                id="deal-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nome do deal"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="deal-description">Descrição</Label>
              <Textarea
                id="deal-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes do deal"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Estágio</Label>
                <Select value={columnId} onValueChange={(v) => setColumnId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v ?? "medium")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Critica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Empresa</Label>
                <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    {(companies || []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Contato</Label>
                <Select value={contactId} onValueChange={(v) => setContactId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    {(contacts || []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="deal-value">Valor (R$)</Label>
                <Input
                  id="deal-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="deal-probability">Probabilidade (%)</Label>
                <Input
                  id="deal-probability"
                  type="number"
                  min="0"
                  max="100"
                  value={probability}
                  onChange={(e) => setProbability(e.target.value)}
                  placeholder="50"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createDeal.isPending || !title}>
              {createDeal.isPending ? "Criando..." : "Criar Deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
