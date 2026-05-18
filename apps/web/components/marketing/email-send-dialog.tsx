"use client";

import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import {
  useSendEmailCampaign,
  useSendEmailCampaignTest,
} from "@/hooks/marketing/use-email-campaigns";
import type { EmailCampaign } from "@/hooks/marketing/use-email-campaigns";
import { useSegments } from "@/hooks/marketing/use-segments";
import { useSegmentContacts } from "@/hooks/marketing/use-segment-contacts";
import { createClient } from "@/lib/supabase/client";
import { parseRecipients } from "@/lib/marketing/recipients";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface EmailSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailCampaign: EmailCampaign | undefined;
}

type SendSource = "segment" | "manual";

export function EmailSendDialog({
  open,
  onOpenChange,
  emailCampaign,
}: EmailSendDialogProps) {
  const sendEmailCampaign = useSendEmailCampaign();
  const sendTest = useSendEmailCampaignTest();
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [source, setSource] = useState<SendSource>("manual");

  const campaignSegmentId = emailCampaign?.segment_id ?? null;
  const { data: segments } = useSegments(emailCampaign?.sector_id);
  const segment = useMemo(
    () =>
      campaignSegmentId
        ? segments?.find((s) => s.id === campaignSegmentId)
        : undefined,
    [segments, campaignSegmentId]
  );
  // Resolve the actual contact list of the attached segment so the dialog can
  // show a true recipient count (W2). Disabled when the campaign has no
  // segment attached.
  const { data: segmentContacts } = useSegmentContacts(
    campaignSegmentId ?? undefined
  );

  const hasSegment = !!campaignSegmentId;
  const segmentCount = segmentContacts?.length ?? 0;

  const formKey = `${open}:${emailCampaign?.id ?? "none"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setRecipientsRaw("");
    // Default to the attached audience when the campaign has one.
    setSource(emailCampaign?.segment_id ? "segment" : "manual");
  }

  const parsed = parseRecipients(recipientsRaw);
  const manualCount = parsed.valid.length;

  const canSend =
    source === "segment" ? hasSegment && segmentCount > 0 : manualCount > 0;

  const handleSend = async () => {
    if (!emailCampaign) return;
    if (!canSend) {
      toast.error(
        source === "segment"
          ? "A audiência não tem contatos"
          : "Informe ao menos um destinatário"
      );
      return;
    }

    const result = await sendEmailCampaign.mutateAsync(
      source === "segment"
        ? { emailCampaignId: emailCampaign.id, source: "segment" }
        : {
            emailCampaignId: emailCampaign.id,
            source: "manual",
            recipients: parsed.valid,
          }
    );

    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao enviar"
      );
      return;
    }

    if (result.noop) {
      toast.warning(result.message ?? "Gateway de e-mail não configurado.", {
        duration: 6000,
      });
    } else {
      toast.success(
        `Envio concluído: ${result.sent ?? 0} enviado(s), ${result.failed ?? 0} falha(s)`
      );
    }
    onOpenChange(false);
  };

  /**
   * Sends a single preview of the campaign to the signed-in user so they can
   * eyeball it before a live blast. Never moves the campaign to `sent`.
   */
  const handleTestSend = async () => {
    if (!emailCampaign) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      toast.error("Não foi possível identificar o seu e-mail");
      return;
    }

    const result = await sendTest.mutateAsync({
      emailCampaignId: emailCampaign.id,
      recipient: {
        email: user.email,
        name: user.user_metadata?.full_name as string | undefined,
      },
    });

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao enviar e-mail de teste"
      );
      return;
    }

    if (result.noop) {
      toast.warning(result.message ?? "Gateway de e-mail não configurado.", {
        duration: 6000,
      });
    } else {
      toast.success(`E-mail de teste enviado para ${user.email}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar campanha de e-mail</DialogTitle>
          <DialogDescription>
            {emailCampaign
              ? `"${emailCampaign.name}" — ${emailCampaign.subject}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">
              Destinatários
            </legend>
            <div className="flex items-start gap-2">
              <input
                type="radio"
                name="send-source"
                value="segment"
                id="send-source-segment"
                checked={source === "segment"}
                disabled={!hasSegment}
                onChange={() => setSource("segment")}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <Label
                htmlFor="send-source-segment"
                className="font-normal leading-snug"
              >
                {hasSegment ? (
                  <>
                    Enviar para a audiência «{segment?.name ?? "audiência"}»{" "}
                    <span className="text-muted-foreground">
                      ({segmentCount} contato
                      {segmentCount === 1 ? "" : "s"})
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    Esta campanha não tem audiência associada
                  </span>
                )}
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <input
                type="radio"
                name="send-source"
                value="manual"
                id="send-source-manual"
                checked={source === "manual"}
                onChange={() => setSource("manual")}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <Label
                htmlFor="send-source-manual"
                className="font-normal leading-snug"
              >
                Informar destinatários manualmente
              </Label>
            </div>
          </fieldset>

          {source === "segment" && hasSegment && segmentCount === 0 && (
            <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
              A audiência «{segment?.name ?? "audiência"}» ainda não tem
              contatos. Adicione contatos pela tela de Audiências ou use o
              envio manual.
            </p>
          )}

          {source === "manual" && (
            <div className="grid gap-2">
              <Label htmlFor="email-recipients">Lista de destinatários</Label>
              <Textarea
                id="email-recipients"
                value={recipientsRaw}
                onChange={(e) => setRecipientsRaw(e.target.value)}
                placeholder={"joao@exemplo.com\nMaria <maria@exemplo.com>"}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Um destinatário por linha (ou separados por vírgula).{" "}
                <span className="font-medium">{manualCount} válido(s)</span>
                {parsed.invalid.length > 0 && (
                  <span className="text-destructive">
                    {" "}
                    · {parsed.invalid.length} inválido(s)
                  </span>
                )}
                {parsed.duplicates > 0 && (
                  <span> · {parsed.duplicates} duplicado(s) ignorado(s)</span>
                )}
                .
              </p>
              {parsed.invalid.length > 0 && (
                <p className="wrap-break-word text-xs text-destructive">
                  Linhas inválidas: {parsed.invalid.slice(0, 5).join(", ")}
                  {parsed.invalid.length > 5
                    ? ` (+${parsed.invalid.length - 5})`
                    : ""}
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Antes de um envio real, use{" "}
            <span className="font-medium">Enviar teste</span> para receber uma
            prévia no seu próprio e-mail.
          </p>
          <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            O envio usa o gateway de e-mail (Resend). Sem credenciais
            configuradas o adaptador opera em modo no-op — os envios são
            registrados como ignorados e nada é enviado de fato.
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestSend}
            disabled={sendTest.isPending || sendEmailCampaign.isPending}
          >
            <Send className="mr-1 h-4 w-4" />
            {sendTest.isPending ? "Enviando teste..." : "Enviar teste"}
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSend}
              disabled={sendEmailCampaign.isPending || !canSend}
            >
              {sendEmailCampaign.isPending
                ? "Enviando..."
                : source === "segment"
                  ? `Enviar (${segmentCount})`
                  : `Enviar (${manualCount})`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
