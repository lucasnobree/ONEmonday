"use client";

import { useState } from "react";
import { useDeals } from "@/hooks/crm/use-deals";
import { useCreateProposal, useUpdateProposal } from "@/hooks/crm/use-proposals";
import type { ProposalDetail } from "@/hooks/crm/use-proposals";
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
import { Plus, Trash2 } from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface ProposalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  proposal?: ProposalDetail;
  defaultDealId?: string;
}

export function ProposalFormDialog({
  open,
  onOpenChange,
  sectorId,
  proposal,
  defaultDealId,
}: ProposalFormDialogProps) {
  const createProposal = useCreateProposal();
  const updateProposal = useUpdateProposal();
  const { data: deals } = useDeals(sectorId);
  const isEdit = !!proposal;

  const emptyItems = (): LineItem[] => [
    { description: "", quantity: 1, unit_price: 0 },
  ];

  const [dealId, setDealId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [items, setItems] = useState<LineItem[]>(emptyItems);

  // Re-seed form state when the dialog is (re)opened for a different
  // proposal. Adjusting state during render — the React-recommended pattern
  // for syncing state to props — instead of an effect.
  const formKey = `${open}:${proposal?.id ?? defaultDealId ?? "new"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    if (proposal) {
      setDealId(proposal.deal_id);
      setTitle(proposal.title);
      setContent(proposal.content ?? "");
      setExpiresAt(proposal.expires_at?.substring(0, 10) ?? "");
      setItems(
        proposal.items.length > 0
          ? proposal.items.map((i) => ({
              description: i.description,
              quantity: i.quantity,
              unit_price: i.unit_price,
            }))
          : emptyItems()
      );
    } else {
      setDealId(defaultDealId ?? "");
      setTitle("");
      setContent("");
      setExpiresAt("");
      setItems(emptyItems());
    }
  }

  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...items];
    if (field === "description") {
      updated[index] = { ...updated[index], description: value as string };
    } else if (field === "quantity") {
      updated[index] = { ...updated[index], quantity: Number(value) || 0 };
    } else {
      updated[index] = { ...updated[index], unit_price: Number(value) || 0 };
    }
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = items.filter((i) => i.description.trim());

    const payload = {
      sectorId,
      dealId,
      title,
      content: content || undefined,
      expiresAt: expiresAt || undefined,
      value: total,
      items: JSON.stringify(validItems),
      ...(isEdit ? { id: proposal.id } : {}),
    };

    const result = isEdit
      ? await updateProposal.mutateAsync(payload)
      : await createProposal.mutateAsync(payload);

    if (result && "error" in result && result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : `Erro ao ${isEdit ? "atualizar" : "criar"} proposta`
      );
      return;
    }

    toast.success(isEdit ? "Proposta atualizada" : "Proposta criada");
    onOpenChange(false);
  };

  const isPending = createProposal.isPending || updateProposal.isPending;

  // Filter to only open deals (no actual_close_date)
  const openDeals = (deals || []).filter((d) => !d.actual_close_date);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Proposta" : "Nova Proposta"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Atualize os dados da proposta"
                : "Crie uma nova proposta comercial"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Deal</Label>
                <Select
                  value={dealId}
                  onValueChange={(v) => setDealId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um deal" />
                  </SelectTrigger>
                  <SelectContent>
                    {openDeals.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.card?.title ?? d.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="proposal-expires">Expira em</Label>
                <Input
                  id="proposal-expires"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="proposal-title">Titulo</Label>
              <Input
                id="proposal-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titulo da proposta"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="proposal-content">Descricao</Label>
              <Textarea
                id="proposal-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Detalhes da proposta..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Itens</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar Item
                </Button>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_80px_120px_32px] gap-2 text-xs font-medium text-muted-foreground">
                  <span>Descricao</span>
                  <span>Qtd</span>
                  <span>Preco Unit.</span>
                  <span />
                </div>
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_80px_120px_32px] gap-2 items-center"
                  >
                    <Input
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, "description", e.target.value)
                      }
                      placeholder="Descricao do item"
                    />
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity || ""}
                      onChange={(e) =>
                        updateItem(index, "quantity", e.target.value)
                      }
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price || ""}
                      onChange={(e) =>
                        updateItem(index, "unit_price", e.target.value)
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2 border-t">
                <p className="text-sm font-semibold">
                  Total: {formatCurrency(total)}
                </p>
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
            <Button type="submit" disabled={isPending || !title || !dealId}>
              {isPending
                ? isEdit
                  ? "Salvando..."
                  : "Criando..."
                : isEdit
                  ? "Salvar"
                  : "Criar Proposta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
