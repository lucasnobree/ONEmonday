"use client";

import { useState } from "react";
import {
  useCreateEmailCampaign,
  useUpdateEmailCampaign,
} from "@/hooks/marketing/use-email-campaigns";
import type { EmailCampaign } from "@/hooks/marketing/use-email-campaigns";
import { useSegments } from "@/hooks/marketing/use-segments";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { textToHtml, sanitizeEmailHtml } from "@/lib/marketing/email-body";
import { toast } from "sonner";

const NO_SEGMENT = "__none__";

/**
 * Body composer modes. `text` derives HTML automatically; `html` is raw; the
 * extra `preview` value is a read-only render tab that does not change which
 * body source is persisted.
 */
type BodyTab = "text" | "html" | "preview";

interface EmailCampaignFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  emailCampaign?: EmailCampaign;
}

export function EmailCampaignFormDialog({
  open,
  onOpenChange,
  sectorId,
  emailCampaign,
}: EmailCampaignFormDialogProps) {
  const createEmailCampaign = useCreateEmailCampaign();
  const updateEmailCampaign = useUpdateEmailCampaign();
  const { data: segments } = useSegments(sectorId);
  const isEdit = !!emailCampaign;

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [fromName, setFromName] = useState("ONEmonday");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyTab, setBodyTab] = useState<BodyTab>("text");
  const [segmentId, setSegmentId] = useState<string>(NO_SEGMENT);

  const formKey = `${open}:${emailCampaign?.id ?? "new"}`;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (open && seededKey !== formKey) {
    setSeededKey(formKey);
    setName(emailCampaign?.name ?? "");
    setSubject(emailCampaign?.subject ?? "");
    setFromName(emailCampaign?.from_name ?? "ONEmonday");
    setFromEmail(emailCampaign?.from_email ?? "");
    setReplyTo(emailCampaign?.reply_to ?? "");
    setBodyText(emailCampaign?.body_text ?? "");
    setBodyHtml(emailCampaign?.body_html ?? "");
    setSegmentId(emailCampaign?.segment_id ?? NO_SEGMENT);
    // Open the HTML tab when an existing campaign already carries hand-written
    // HTML that is not just the auto-derived text wrapper.
    setBodyTab(
      emailCampaign &&
        emailCampaign.body_html.trim().length > 0 &&
        emailCampaign.body_html !== textToHtml(emailCampaign.body_text ?? "")
        ? "html"
        : "text"
    );
  }

  // The HTML actually persisted: the raw HTML the operator wrote (sanitised)
  // when the HTML tab holds content, otherwise the HTML derived from the plain
  // text. The read-only `preview` tab never changes the source. Recomputed
  // live so the preview stays accurate.
  const resolvedHtml =
    bodyHtml.trim().length > 0
      ? sanitizeEmailHtml(bodyHtml)
      : textToHtml(bodyText);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const common = {
      name,
      subject,
      fromName,
      fromEmail,
      replyTo: replyTo || null,
      bodyText,
      bodyHtml: resolvedHtml,
      campaignId: null,
      segmentId: segmentId === NO_SEGMENT ? null : segmentId,
    };

    const payload = isEdit
      ? { id: emailCampaign.id, ...common }
      : { sectorId, ...common };

    const result = isEdit
      ? await updateEmailCampaign.mutateAsync(payload)
      : await createEmailCampaign.mutateAsync(payload);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : `Erro ao ${isEdit ? "atualizar" : "criar"} campanha de e-mail`
      );
      return;
    }

    toast.success(
      isEdit ? "Campanha de e-mail atualizada" : "Campanha de e-mail criada"
    );
    onOpenChange(false);
  };

  const isPending =
    createEmailCampaign.isPending || updateEmailCampaign.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Editar Campanha de E-mail" : "Nova Campanha de E-mail"}
            </DialogTitle>
            <DialogDescription>
              Componha um e-mail e selecione a audiência de destino.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email-name">Nome interno</Label>
              <Input
                id="email-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Newsletter de maio"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email-subject">Assunto</Label>
              <Input
                id="email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Novidades deste mês"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email-from-name">Nome do remetente</Label>
                <Input
                  id="email-from-name"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email-from-email">E-mail do remetente</Label>
                <Input
                  id="email-from-email"
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="contato@suaempresa.com"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email-reply-to">Responder para (opcional)</Label>
                <Input
                  id="email-reply-to"
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email-segment">Audiência</Label>
                <Select
                  value={segmentId}
                  onValueChange={(v) => setSegmentId(v ?? NO_SEGMENT)}
                >
                  <SelectTrigger id="email-segment" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SEGMENT}>Sem audiência</SelectItem>
                    {(segments ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Corpo do e-mail</Label>
              <Tabs
                value={bodyTab}
                onValueChange={(v) => setBodyTab(v as BodyTab)}
              >
                <TabsList>
                  <TabsTrigger value="text">Texto</TabsTrigger>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                  <TabsTrigger value="preview">Prévia</TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="mt-2">
                  <Textarea
                    id="email-body-text"
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder="Escreva o conteúdo do e-mail..."
                    rows={7}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Texto simples — parágrafos e quebras de linha viram HTML
                    automaticamente.
                  </p>
                </TabsContent>

                <TabsContent value="html" className="mt-2">
                  <Textarea
                    id="email-body-html"
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    placeholder="<h1>Olá!</h1><p>Conteúdo do e-mail...</p>"
                    rows={7}
                    className="font-mono text-xs"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    HTML é higienizado (scripts e handlers de evento são
                    removidos) antes de salvar. O texto simples acima é o
                    fallback para clientes sem HTML.
                  </p>
                </TabsContent>

                <TabsContent value="preview" className="mt-2">
                  <div className="rounded-md border bg-white p-4 text-sm text-black">
                    {resolvedHtml.trim().length > 0 ? (
                      <div
                        // Preview only — the same sanitised HTML that will be
                        // persisted and sent. resolveBodyHtml/sanitizeEmailHtml
                        // strip script/style/handler vectors.
                        dangerouslySetInnerHTML={{ __html: resolvedHtml }}
                      />
                    ) : (
                      <p className="text-muted-foreground">
                        Sem conteúdo para pré-visualizar.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
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
            <Button
              type="submit"
              disabled={
                isPending || !name || !subject || !resolvedHtml.trim()
              }
            >
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
