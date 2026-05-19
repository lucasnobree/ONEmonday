"use client";

import { useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { toast } from "sonner";
import { useSectorScope } from "@/hooks/use-sector-scope";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { SectorScopeFilter } from "@/components/shared/sector-scope-filter";
import { sectorFilterValue } from "@/lib/navigation/scoped-query";
import {
  useCampaigns,
  useDeleteCampaign,
  type Campaign,
} from "@/hooks/marketing/use-campaigns";
import { CampaignFormDialog } from "@/components/marketing/campaign-form-dialog";
import { MarketingError } from "@/components/marketing/marketing-error";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export default function MarketingCampaignsPage() {
  const { scope } = useSectorScope();
  const { currentSector } = useCurrentSector();
  const {
    data: campaigns,
    isLoading,
    isError,
    refetch,
  } = useCampaigns(scope);
  const deleteCampaign = useDeleteCampaign();
  // Creating a campaign needs a concrete target sector.
  const createSectorId = sectorFilterValue(scope) ?? currentSector?.id ?? null;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign>();

  const handleDelete = async (id: string) => {
    const result = await deleteCampaign.mutateAsync(id);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao excluir"
      );
      return;
    }
    toast.success("Campanha excluída");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Campanhas</h2>
          <SectorScopeFilter />
        </div>
        <Button
          size="sm"
          disabled={!createSectorId}
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
      ) : isError ? (
        <MarketingError subject="as campanhas" onRetry={() => refetch()} />
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
                  <ConfirmDialog
                    title="Excluir campanha"
                    description={`Excluir a campanha "${c.name}"? Esta ação remove o orçamento e os resultados registrados.`}
                    onConfirm={() => handleDelete(c.id)}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500"
                      disabled={deleteCampaign.isPending}
                    >
                      Excluir
                    </Button>
                  </ConfirmDialog>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <Megaphone className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma campanha ainda. Crie a primeira para acompanhar orçamento e
            resultados.
          </p>
        </div>
      )}

      {createSectorId && (
        <CampaignFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          sectorId={createSectorId}
          campaign={editing}
        />
      )}
    </div>
  );
}
