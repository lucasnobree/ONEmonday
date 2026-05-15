"use client";

import { useState } from "react";
import {
  useCreateSegment,
  useUpdateSegment,
} from "@/hooks/marketing/use-segments";
import type { AudienceSegment } from "@/hooks/marketing/use-segments";
import type { MarketingChannel } from "@/lib/validations/marketing";
import { MARKETING_CHANNELS } from "@/lib/validations/marketing";
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
import { CHANNEL_LABELS } from "@/lib/marketing/labels";

interface SegmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  segment?: AudienceSegment;
}

export function SegmentFormDialog({
  open,
  onOpenChange,
  sectorId,
  segment,
}: SegmentFormDialogProps) {
  const createSegment = useCreateSegment();
  const updateSegment = useUpdateSegment();
  const isEdit = !!segment;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [channel, setChannel] = useState<MarketingChannel>("email");
  const [estimatedSize, setEstimatedSize] = useState("0");

  const formKey = `${open}:${segment?.id ?? "new"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setName(segment?.name ?? "");
    setDescription(segment?.description ?? "");
    setChannel(segment?.channel ?? "email");
    setEstimatedSize(String(segment?.estimated_size ?? 0));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const size = Number(estimatedSize);
    if (!Number.isInteger(size) || size < 0) {
      toast.error("Tamanho deve ser um numero inteiro nao negativo");
      return;
    }

    const common = {
      name,
      description: description || undefined,
      channel,
      estimatedSize: size,
    };

    const payload = isEdit
      ? { id: segment.id, ...common }
      : { sectorId, ...common };

    const result = isEdit
      ? await updateSegment.mutateAsync(payload)
      : await createSegment.mutateAsync(payload);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : `Erro ao ${isEdit ? "atualizar" : "criar"} audiencia`
      );
      return;
    }

    toast.success(isEdit ? "Audiencia atualizada" : "Audiencia criada");
    onOpenChange(false);
  };

  const isPending = createSegment.isPending || updateSegment.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Audiencia" : "Nova Audiencia"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Atualize os dados da audiencia"
                : "Defina um segmento de audiencia reutilizavel"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="segment-name">Nome</Label>
              <Input
                id="segment-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Clientes ativos - SP"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Canal</Label>
                <Select
                  value={channel}
                  onValueChange={(v) => setChannel(v as MarketingChannel)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MARKETING_CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CHANNEL_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="segment-size">Tamanho estimado</Label>
                <Input
                  id="segment-size"
                  type="number"
                  min={0}
                  step={1}
                  value={estimatedSize}
                  onChange={(e) => setEstimatedSize(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="segment-description">Descricao</Label>
              <Textarea
                id="segment-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Criterios e detalhes do segmento"
              />
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
            <Button type="submit" disabled={isPending || !name}>
              {isPending
                ? "Salvando..."
                : isEdit
                  ? "Salvar"
                  : "Criar Audiencia"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
