"use client";

import { useState } from "react";
import { Mail, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useSectorScope } from "@/hooks/use-sector-scope";
import { SectorScopeFilter } from "@/components/shared/sector-scope-filter";
import { sectorFilterValue } from "@/lib/navigation/scoped-query";
import {
  useEmailCampaigns,
  useDeleteEmailCampaign,
  type EmailCampaign,
} from "@/hooks/marketing/use-email-campaigns";
import { EmailCampaignFormDialog } from "@/components/marketing/email-campaign-form-dialog";
import { EmailSendDialog } from "@/components/marketing/email-send-dialog";
import { MarketingError } from "@/components/marketing/marketing-error";
import {
  EMAIL_CAMPAIGN_STATUS_LABELS,
  EMAIL_CAMPAIGN_STATUS_VARIANTS,
} from "@/lib/marketing/labels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export default function MarketingEmailPage() {
  const { scope } = useSectorScope();
  const { currentSector } = useCurrentSector();
  const {
    data: emailCampaigns,
    isLoading,
    isError,
    refetch,
  } = useEmailCampaigns(scope);
  const deleteEmailCampaign = useDeleteEmailCampaign();

  const [formOpen, setFormOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [editing, setEditing] = useState<EmailCampaign>();
  const [sending, setSending] = useState<EmailCampaign>();

  // Creating a campaign needs a concrete target sector; under the all-sectors
  // scope fall back to the sidebar's current sector. An edited campaign keeps
  // its own sector.
  const createSectorId = sectorFilterValue(scope) ?? currentSector?.id ?? null;
  const dialogSectorId = editing?.sector_id ?? createSectorId;

  const handleDelete = async (id: string) => {
    const result = await deleteEmailCampaign.mutateAsync(id);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao excluir"
      );
      return;
    }
    toast.success("Campanha de e-mail excluída");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Campanhas de E-mail</h2>
          <p className="text-xs text-muted-foreground">
            Componha e envie e-mails para uma audiência via gateway ESP.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SectorScopeFilter />
          <Button
            size="sm"
            disabled={!createSectorId}
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Nova Campanha
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : isError ? (
        <MarketingError
          subject="as campanhas de e-mail"
          onRetry={() => refetch()}
        />
      ) : emailCampaigns && emailCampaigns.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            {emailCampaigns.map((c) => {
              const locked = c.status === "sent" || c.status === "sending";
              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.subject}
                    </p>
                  </div>
                  {c.status === "sent" && (
                    <span className="text-xs text-muted-foreground">
                      {c.delivered_count}/{c.recipient_count} entregues
                      {c.failed_count > 0
                        ? ` · ${c.failed_count} falha(s)`
                        : ""}
                    </span>
                  )}
                  <Badge variant={EMAIL_CAMPAIGN_STATUS_VARIANTS[c.status]}>
                    {EMAIL_CAMPAIGN_STATUS_LABELS[c.status]}
                  </Badge>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={locked}
                      onClick={() => {
                        setSending(c);
                        setSendOpen(true);
                      }}
                    >
                      <Send className="mr-1 h-3.5 w-3.5" />
                      Enviar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={locked}
                      onClick={() => {
                        setEditing(c);
                        setFormOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                    <ConfirmDialog
                      title="Excluir campanha de e-mail"
                      description={`Excluir a campanha "${c.name}"? Esta ação não pode ser desfeita.`}
                      onConfirm={() => handleDelete(c.id)}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500"
                        disabled={deleteEmailCampaign.isPending}
                      >
                        Excluir
                      </Button>
                    </ConfirmDialog>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <Mail className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma campanha de e-mail ainda. Crie a primeira para enviar
            e-mails a uma audiência.
          </p>
        </div>
      )}

      {dialogSectorId && (
        <EmailCampaignFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          sectorId={dialogSectorId}
          emailCampaign={editing}
        />
      )}
      <EmailSendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        emailCampaign={sending}
      />
    </div>
  );
}
