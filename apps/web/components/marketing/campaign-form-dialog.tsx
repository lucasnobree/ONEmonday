"use client";

import { useState } from "react";
import {
  useCreateCampaign,
  useUpdateCampaign,
} from "@/hooks/marketing/use-campaigns";
import type { Campaign } from "@/hooks/marketing/use-campaigns";
import type {
  MarketingChannel,
  CampaignStatus,
} from "@/lib/validations/marketing";
import {
  MARKETING_CHANNELS,
  CAMPAIGN_STATUSES,
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
import { MoneyInput } from "@/components/finance/money-input";
import { CHANNEL_LABELS, CAMPAIGN_STATUS_LABELS } from "@/lib/marketing/labels";

const today = () => new Date().toISOString().slice(0, 10);

interface CampaignFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  campaign?: Campaign;
}

export function CampaignFormDialog({
  open,
  onOpenChange,
  sectorId,
  campaign,
}: CampaignFormDialogProps) {
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const isEdit = !!campaign;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [channel, setChannel] = useState<MarketingChannel>("email");
  const [status, setStatus] = useState<CampaignStatus>("draft");
  const [budgetCents, setBudgetCents] = useState<number | null>(0);
  const [spendCents, setSpendCents] = useState<number | null>(0);
  const [impressions, setImpressions] = useState("0");
  const [leads, setLeads] = useState("0");
  const [conversions, setConversions] = useState("0");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState("");

  // Re-seed the form when the dialog (re)opens — state adjusted during render.
  const formKey = `${open}:${campaign?.id ?? "new"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setName(campaign?.name ?? "");
    setDescription(campaign?.description ?? "");
    setChannel(campaign?.channel ?? "email");
    setStatus(campaign?.status ?? "draft");
    setBudgetCents(campaign?.budget_cents ?? 0);
    setSpendCents(campaign?.spend_cents ?? 0);
    setImpressions(String(campaign?.impressions ?? 0));
    setLeads(String(campaign?.leads ?? 0));
    setConversions(String(campaign?.conversions ?? 0));
    setStartDate(campaign?.start_date ?? today());
    setEndDate(campaign?.end_date ?? "");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numImpressions = Number(impressions);
    const numLeads = Number(leads);
    const numConversions = Number(conversions);
    if (
      !Number.isInteger(numImpressions) ||
      !Number.isInteger(numLeads) ||
      !Number.isInteger(numConversions) ||
      numImpressions < 0 ||
      numLeads < 0 ||
      numConversions < 0
    ) {
      toast.error("Metricas devem ser numeros inteiros nao negativos");
      return;
    }

    const common = {
      name,
      description: description || undefined,
      channel,
      status,
      budgetCents: budgetCents ?? 0,
      spendCents: spendCents ?? 0,
      impressions: numImpressions,
      leads: numLeads,
      conversions: numConversions,
      startDate,
      endDate: endDate || null,
    };

    const payload = isEdit
      ? { id: campaign.id, ...common }
      : { sectorId, ...common };

    const result = isEdit
      ? await updateCampaign.mutateAsync(payload)
      : await createCampaign.mutateAsync(payload);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : `Erro ao ${isEdit ? "atualizar" : "criar"} campanha`
      );
      return;
    }

    toast.success(isEdit ? "Campanha atualizada" : "Campanha criada");
    onOpenChange(false);
  };

  const isPending = createCampaign.isPending || updateCampaign.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Campanha" : "Nova Campanha"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Atualize os dados da campanha"
                : "Registre uma nova campanha de marketing"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="campaign-name">Nome</Label>
              <Input
                id="campaign-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Lancamento de produto"
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
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as CampaignStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CAMPAIGN_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="campaign-budget">Orcamento (R$)</Label>
                <MoneyInput
                  id="campaign-budget"
                  valueCents={budgetCents}
                  onChangeCents={setBudgetCents}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="campaign-spend">Gasto (R$)</Label>
                <MoneyInput
                  id="campaign-spend"
                  valueCents={spendCents}
                  onChangeCents={setSpendCents}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="campaign-impressions">Impressoes</Label>
                <Input
                  id="campaign-impressions"
                  type="number"
                  min={0}
                  step={1}
                  value={impressions}
                  onChange={(e) => setImpressions(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="campaign-leads">Leads</Label>
                <Input
                  id="campaign-leads"
                  type="number"
                  min={0}
                  step={1}
                  value={leads}
                  onChange={(e) => setLeads(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="campaign-conversions">Conversoes</Label>
                <Input
                  id="campaign-conversions"
                  type="number"
                  min={0}
                  step={1}
                  value={conversions}
                  onChange={(e) => setConversions(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="campaign-start">Inicio</Label>
                <Input
                  id="campaign-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="campaign-end">Fim (opcional)</Label>
                <Input
                  id="campaign-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="campaign-description">Descricao</Label>
              <Textarea
                id="campaign-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Objetivo e detalhes da campanha"
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
                  : "Criar Campanha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
