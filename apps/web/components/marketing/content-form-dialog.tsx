"use client";

import { useState } from "react";
import {
  useCreateContentItem,
  useUpdateContentItem,
} from "@/hooks/marketing/use-content-items";
import type { ContentItem } from "@/hooks/marketing/use-content-items";
import type { Campaign } from "@/hooks/marketing/use-campaigns";
import type {
  MarketingChannel,
  ContentStatus,
} from "@/lib/validations/marketing";
import {
  MARKETING_CHANNELS,
  CONTENT_STATUSES,
} from "@/lib/validations/marketing";
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
import { CHANNEL_LABELS, CONTENT_STATUS_LABELS } from "@/lib/marketing/labels";

const today = () => new Date().toISOString().slice(0, 10);
const NO_CAMPAIGN = "none";

interface ContentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  campaigns: Campaign[];
  item?: ContentItem;
  /** Pre-fills the scheduled date (e.g. when adding from a calendar cell). */
  defaultDate?: string;
}

export function ContentFormDialog({
  open,
  onOpenChange,
  sectorId,
  campaigns,
  item,
  defaultDate,
}: ContentFormDialogProps) {
  const createItem = useCreateContentItem();
  const updateItem = useUpdateContentItem();
  const isEdit = !!item;

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [channel, setChannel] = useState<MarketingChannel>("social");
  const [status, setStatus] = useState<ContentStatus>("idea");
  const [scheduledDate, setScheduledDate] = useState(today());
  const [campaignId, setCampaignId] = useState<string>(NO_CAMPAIGN);

  const formKey = `${open}:${item?.id ?? "new"}:${defaultDate ?? ""}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setTitle(item?.title ?? "");
    setNotes(item?.notes ?? "");
    setChannel(item?.channel ?? "social");
    setStatus(item?.status ?? "idea");
    setScheduledDate(item?.scheduled_date ?? defaultDate ?? today());
    setCampaignId(item?.campaign_id ?? NO_CAMPAIGN);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const common = {
      title,
      notes: notes || undefined,
      channel,
      status,
      scheduledDate,
      campaignId: campaignId === NO_CAMPAIGN ? null : campaignId,
    };

    const payload = isEdit ? { id: item.id, ...common } : { sectorId, ...common };

    const result = isEdit
      ? await updateItem.mutateAsync(payload)
      : await createItem.mutateAsync(payload);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : `Erro ao ${isEdit ? "atualizar" : "criar"} conteúdo`
      );
      return;
    }

    toast.success(isEdit ? "Conteúdo atualizado" : "Conteúdo criado");
    onOpenChange(false);
  };

  const isPending = createItem.isPending || updateItem.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Conteúdo" : "Novo Conteúdo"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Atualize o item do calendário editorial"
                : "Agende um item no calendário editorial"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="content-title">Título</Label>
              <Input
                id="content-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Post sobre o lançamento"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="content-channel">Canal</Label>
                <Select
                  value={channel}
                  onValueChange={(v) => setChannel(v as MarketingChannel)}
                >
                  <SelectTrigger id="content-channel" className="w-full">
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
                <Label htmlFor="content-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as ContentStatus)}
                >
                  <SelectTrigger id="content-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CONTENT_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="content-date">Data agendada</Label>
                <Input
                  id="content-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="content-campaign">Campanha</Label>
                <Select
                  value={campaignId}
                  onValueChange={(v) => v && setCampaignId(v)}
                >
                  <SelectTrigger id="content-campaign" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CAMPAIGN}>Sem campanha</SelectItem>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="content-notes">Notas</Label>
              <Textarea
                id="content-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Briefing, links e detalhes"
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
            <Button type="submit" disabled={isPending || !title}>
              {isPending
                ? "Salvando..."
                : isEdit
                  ? "Salvar"
                  : "Criar Conteúdo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
