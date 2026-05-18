"use client";

import { useState } from "react";
import { useSendEmailCampaign } from "@/hooks/marketing/use-email-campaigns";
import type { EmailCampaign } from "@/hooks/marketing/use-email-campaigns";
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

/** Parses a textarea of `email` or `Name <email>` lines into recipient rows. */
function parseRecipients(
  raw: string
): { email: string; name?: string }[] {
  return raw
    .split(/[\n,;]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = line.match(/^(.*?)<(.+?)>$/);
      if (match) {
        return { name: match[1].trim() || undefined, email: match[2].trim() };
      }
      return { email: line };
    });
}

export function EmailSendDialog({
  open,
  onOpenChange,
  emailCampaign,
}: EmailSendDialogProps) {
  const sendEmailCampaign = useSendEmailCampaign();
  const [recipientsRaw, setRecipientsRaw] = useState("");

  const formKey = `${open}:${emailCampaign?.id ?? "none"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setRecipientsRaw("");
  }

  const recipients = parseRecipients(recipientsRaw);

  const handleSend = async () => {
    if (!emailCampaign) return;
    if (recipients.length === 0) {
      toast.error("Informe ao menos um destinatário");
      return;
    }

    const result = await sendEmailCampaign.mutateAsync({
      emailCampaignId: emailCampaign.id,
      recipients,
    });

    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao enviar"
      );
      return;
    }

    if (result.noop) {
      toast.warning(
        result.message ?? "Gateway de e-mail não configurado.",
        { duration: 6000 }
      );
    } else {
      toast.success(
        `Envio concluído: ${result.sent ?? 0} enviado(s), ${result.failed ?? 0} falha(s)`
      );
    }
    onOpenChange(false);
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
          <div className="grid gap-2">
            <Label htmlFor="email-recipients">Destinatários</Label>
            <Textarea
              id="email-recipients"
              value={recipientsRaw}
              onChange={(e) => setRecipientsRaw(e.target.value)}
              placeholder={"joao@exemplo.com\nMaria <maria@exemplo.com>"}
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              Um destinatário por linha (ou separados por vírgula).{" "}
              {recipients.length} destinatário(s) detectado(s).
            </p>
          </div>
          <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            O envio usa o gateway de e-mail (Resend). Sem credenciais
            configuradas o adaptador opera em modo no-op — os envios são
            registrados como ignorados e nada é enviado de fato.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sendEmailCampaign.isPending || recipients.length === 0}
          >
            {sendEmailCampaign.isPending
              ? "Enviando..."
              : `Enviar (${recipients.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
