"use client";

import { useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { toast } from "sonner";
import { useCurrentSector } from "@/hooks/use-current-sector";
import {
  useCampaigns,
  useDeleteCampaign,
  type Campaign,
} from "@/hooks/marketing/use-campaigns";
import { CampaignFormDialog } from "@/components/marketing/campaign-form-dialog";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_VARIANTS,
  CHANNEL_LABELS,
} from "@/lib/marketing/labels";
import { formatCents } from "@/lib/finance/money";
import { budgetUsagePercent } from "@/lib/marketing/metrics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MarketingCampaignsPage() {
  const { currentSector } = useCurrentSector();
  const { data: campaigns, isLoading } = useCampaigns(currentSector?.id);
  const deleteCampaign = useDeleteCampaign();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign>();

  if (!currentSector) {
    return (
      <p className="text-sm text-muted-foreground">
        Selecione um setor no menu lateral para ver as campanhas.
      </p>
    );
  }

  const handleDelete = async (id: string) => {
    const result = await deleteCampaign.mutateAsync(id);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao excluir"
      );
      return;
    }
    toast.success("Campanha excluida");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Campanhas</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : campaigns && campaigns.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {CHANNEL_LABELS[c.channel]} ·{" "}
                    {formatCents(c.spend_cents)} de {formatCents(c.budget_cents)}{" "}
                    ({budgetUsagePercent(c.spend_cents, c.budget_cents)}%)
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {c.leads} leads · {c.conversions} conv.
                </span>
                <Badge variant={CAMPAIGN_STATUS_VARIANTS[c.status]}>
                  {CAMPAIGN_STATUS_LABELS[c.status]}
                </Badge>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(c);
                      setDialogOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500"
                    disabled={deleteCampaign.isPending}
                    onClick={() => handleDelete(c.id)}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <Megaphone className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma campanha ainda. Crie a primeira para acompanhar orcamento e
            resultados.
          </p>
        </div>
      )}

      <CampaignFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sectorId={currentSector.id}
        campaign={editing}
      />
    </div>
  );
}
