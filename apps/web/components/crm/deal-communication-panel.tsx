"use client";

import { useMemo, useState } from "react";
import type { Activity } from "@/hooks/crm/use-activities";
import {
  useSendWhatsapp,
  useLogEmail,
  useSendEmail,
} from "@/hooks/crm/use-activities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  MessageCircle,
  Mail,
  ArrowDownLeft,
  ArrowUpRight,
  Send,
  FileText,
  Settings2,
} from "lucide-react";
import { useMessageTemplates } from "@/hooks/crm/use-message-templates";
import {
  renderTemplate,
  type TemplateContext,
} from "@/lib/crm/message-templates";
import { MessageTemplatesDialog } from "./message-templates-dialog";

const timeFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

interface DealCommunicationPanelProps {
  sectorId: string;
  dealId: string;
  contactId?: string | null;
  companyId?: string | null;
  /** Default WhatsApp number — usually the linked contact's phone. */
  contactPhone?: string | null;
  /** Default recipient address — usually the linked contact's email. */
  contactEmail?: string | null;
  /** Linked contact name — feeds template merge fields. */
  contactName?: string | null;
  /** Linked company name — feeds template merge fields. */
  companyName?: string | null;
  /** Deal title — feeds template merge fields. */
  dealTitle?: string | null;
  /** All activities for the deal; this panel filters to communication ones. */
  activities: Activity[] | undefined;
}

/**
 * Communication tab of the deal detail sheet — the RD Station CRM
 * "WhatsApp inside the deal" + "email logging" replacement.
 *
 *  - Renders the conversation thread: every `whatsapp` / `email` activity,
 *    inbound vs outbound, ordered by `occurred_at`.
 *  - "Enviar WhatsApp" sends a message through the Phase-1 WhatsApp adapter;
 *    the sent message is logged back as an outbound activity.
 *  - "Enviar e-mail" sends an email through the Phase-5 Resend ESP adapter;
 *    the sent email is logged back as an outbound activity.
 *  - "Registrar e-mail" logs a manual email exchange that happened outside
 *    ONEmonday. Inbound emails are logged automatically by the inbound-email
 *    webhook; a full IMAP two-way sync is out of scope.
 */
export function DealCommunicationPanel({
  sectorId,
  dealId,
  contactId,
  companyId,
  contactPhone,
  contactEmail,
  contactName,
  companyName,
  dealTitle,
  activities,
}: DealCommunicationPanelProps) {
  const sendWhatsapp = useSendWhatsapp();
  const sendEmail = useSendEmail();
  const logEmail = useLogEmail();
  const { data: templates } = useMessageTemplates(sectorId);

  // Merge-field values for `{{variable}}` substitution in templates.
  const templateContext: TemplateContext = {
    contactName,
    companyName,
    dealTitle,
  };

  // Templates whose channel matches each composer.
  const whatsappTemplates = (templates ?? []).filter(
    (t) => t.channel === "whatsapp"
  );
  const emailTemplates = (templates ?? []).filter((t) => t.channel === "email");

  // Which channel the template-manager dialog is open for (null = closed).
  const [managingChannel, setManagingChannel] = useState<
    "whatsapp" | "email" | null
  >(null);

  const [mode, setMode] = useState<"whatsapp" | "send-email" | "log-email">(
    "whatsapp"
  );
  const [waTo, setWaTo] = useState(contactPhone ?? "");
  const [waBody, setWaBody] = useState("");
  // "Enviar e-mail" composer.
  const [sendTo, setSendTo] = useState(contactEmail ?? "");
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  // "Registrar e-mail" manual-log form.
  const [emailDirection, setEmailDirection] = useState<
    "inbound" | "outbound"
  >("outbound");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailCounterpart, setEmailCounterpart] = useState("");

  // The conversation thread: communication activities, oldest first so it
  // reads top-to-bottom like a chat.
  const thread = useMemo(() => {
    return (activities ?? [])
      .filter((a) => a.channel === "whatsapp" || a.channel === "email")
      .slice()
      .sort(
        (a, b) =>
          new Date(a.occurred_at).getTime() -
          new Date(b.occurred_at).getTime()
      );
  }, [activities]);

  async function handleSendWhatsapp() {
    if (!waBody.trim() || !waTo.trim()) return;
    const result = await sendWhatsapp.mutateAsync({
      sectorId,
      dealId,
      contactId: contactId || undefined,
      companyId: companyId || undefined,
      to: waTo.trim(),
      body: waBody.trim(),
    });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Verifique o número e a mensagem."
      );
      return;
    }
    toast.success(
      result.noop
        ? "Mensagem registrada (WhatsApp não configurado — modo demo)"
        : "WhatsApp enviado e registrado no histórico"
    );
    setWaBody("");
  }

  async function handleSendEmail() {
    if (!sendTo.trim() || !sendSubject.trim() || !sendBody.trim()) return;
    const result = await sendEmail.mutateAsync({
      sectorId,
      dealId,
      contactId: contactId || undefined,
      companyId: companyId || undefined,
      to: sendTo.trim(),
      subject: sendSubject.trim(),
      body: sendBody.trim(),
    });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Verifique o destinatário e a mensagem."
      );
      return;
    }
    toast.success(
      result.noop
        ? "E-mail registrado (provedor não configurado — modo demo)"
        : "E-mail enviado e registrado no histórico"
    );
    setSendSubject("");
    setSendBody("");
  }

  async function handleLogEmail() {
    if (!emailSubject.trim() || !emailBody.trim()) return;
    const result = await logEmail.mutateAsync({
      sectorId,
      dealId,
      contactId: contactId || undefined,
      companyId: companyId || undefined,
      direction: emailDirection,
      subject: emailSubject.trim(),
      body: emailBody.trim(),
      counterpartEmail: emailCounterpart.trim() || undefined,
    });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Verifique os campos e tente novamente."
      );
      return;
    }
    toast.success("E-mail registrado no histórico");
    setEmailSubject("");
    setEmailBody("");
    setEmailCounterpart("");
  }

  // Apply a WhatsApp template — substitute its merge fields into the composer.
  function applyWhatsappTemplate(templateId: string | null) {
    const tpl = whatsappTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    setWaBody(renderTemplate(tpl.body, templateContext));
  }

  // Apply an email template — fills both the subject and the body.
  function applyEmailTemplate(templateId: string | null) {
    const tpl = emailTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    setSendSubject(renderTemplate(tpl.subject ?? "", templateContext));
    setSendBody(renderTemplate(tpl.body, templateContext));
  }

  return (
    <div className="space-y-4">
      {/* Conversation thread */}
      {thread.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Nenhuma comunicação registrada. Envie um WhatsApp ou registre um
          e-mail abaixo.
        </p>
      ) : (
        <div className="space-y-2">
          {thread.map((a) => {
            const inbound = a.direction === "inbound";
            const isWa = a.channel === "whatsapp";
            return (
              <div
                key={a.id}
                className={`flex ${inbound ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg border px-3 py-2 text-sm ${
                    inbound
                      ? "bg-muted"
                      : "bg-primary/10 border-primary/20"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    {isWa ? (
                      <MessageCircle className="h-3 w-3 text-green-600" />
                    ) : (
                      <Mail className="h-3 w-3 text-blue-600" />
                    )}
                    {inbound ? (
                      <ArrowDownLeft className="h-3 w-3" />
                    ) : (
                      <ArrowUpRight className="h-3 w-3" />
                    )}
                    <span>{isWa ? "WhatsApp" : "E-mail"}</span>
                    <span>·</span>
                    <span>
                      {timeFormat.format(new Date(a.occurred_at))}
                    </span>
                  </div>
                  {a.channel === "email" && (
                    <p className="mt-0.5 text-sm font-medium">{a.subject}</p>
                  )}
                  {a.description && (
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">
                      {a.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Separator />

      {/* Composer mode toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "whatsapp" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setMode("whatsapp")}
        >
          <MessageCircle className="h-3.5 w-3.5 mr-1" />
          WhatsApp
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "send-email" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setMode("send-email")}
        >
          <Send className="h-3.5 w-3.5 mr-1" />
          Enviar e-mail
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "log-email" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setMode("log-email")}
        >
          <Mail className="h-3.5 w-3.5 mr-1" />
          Registrar e-mail
        </Button>
      </div>

      {mode === "whatsapp" && (
        <div className="space-y-2">
          {/* Template picker — reusable snippets with merge fields. */}
          <div className="flex items-center gap-2">
            <Select
              value=""
              onValueChange={applyWhatsappTemplate}
              disabled={whatsappTemplates.length === 0}
            >
              <SelectTrigger
                className="h-8 flex-1 text-xs"
                aria-label="Usar template de WhatsApp"
              >
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  {whatsappTemplates.length === 0
                    ? "Nenhum template"
                    : "Usar template"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {whatsappTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label="Gerenciar templates de WhatsApp"
              onClick={() => setManagingChannel("whatsapp")}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            <Label htmlFor="wa-to" className="text-xs">
              Número (WhatsApp)
            </Label>
            <Input
              id="wa-to"
              value={waTo}
              onChange={(e) => setWaTo(e.target.value)}
              placeholder="+55 11 99999-9999"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wa-body" className="text-xs">
              Mensagem
            </Label>
            <Textarea
              id="wa-body"
              value={waBody}
              onChange={(e) => setWaBody(e.target.value)}
              placeholder="Escreva a mensagem..."
              rows={3}
            />
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={handleSendWhatsapp}
            disabled={
              sendWhatsapp.isPending || !waBody.trim() || !waTo.trim()
            }
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            {sendWhatsapp.isPending ? "Enviando..." : "Enviar WhatsApp"}
          </Button>
        </div>
      )}

      {mode === "send-email" && (
        <div className="space-y-2">
          {/* Template picker — fills the subject and body from a snippet. */}
          <div className="flex items-center gap-2">
            <Select
              value=""
              onValueChange={applyEmailTemplate}
              disabled={emailTemplates.length === 0}
            >
              <SelectTrigger
                className="h-8 flex-1 text-xs"
                aria-label="Usar template de e-mail"
              >
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  {emailTemplates.length === 0
                    ? "Nenhum template"
                    : "Usar template"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {emailTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label="Gerenciar templates de e-mail"
              onClick={() => setManagingChannel("email")}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            <Label htmlFor="send-to" className="text-xs">
              Para (e-mail)
            </Label>
            <Input
              id="send-to"
              type="email"
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              placeholder="contato@email.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="send-subject" className="text-xs">
              Assunto
            </Label>
            <Input
              id="send-subject"
              value={sendSubject}
              onChange={(e) => setSendSubject(e.target.value)}
              placeholder="Assunto do e-mail"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="send-body" className="text-xs">
              Mensagem
            </Label>
            <Textarea
              id="send-body"
              value={sendBody}
              onChange={(e) => setSendBody(e.target.value)}
              placeholder="Escreva o e-mail..."
              rows={4}
            />
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={handleSendEmail}
            disabled={
              sendEmail.isPending ||
              !sendTo.trim() ||
              !sendSubject.trim() ||
              !sendBody.trim()
            }
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            {sendEmail.isPending ? "Enviando..." : "Enviar e-mail"}
          </Button>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Enviado pelo provedor de e-mail (Resend) e registrado no histórico.
            E-mails recebidos são registrados automaticamente pelo webhook de
            entrada — a sincronização IMAP completa está fora do escopo.
          </p>
        </div>
      )}

      {mode === "log-email" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Direção</Label>
              <Select
                value={emailDirection}
                onValueChange={(v) =>
                  setEmailDirection(
                    (v as "inbound" | "outbound") ?? "outbound"
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Enviado</SelectItem>
                  <SelectItem value="inbound">Recebido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="email-counterpart" className="text-xs">
                {emailDirection === "inbound" ? "De" : "Para"} (e-mail)
              </Label>
              <Input
                id="email-counterpart"
                type="email"
                value={emailCounterpart}
                onChange={(e) => setEmailCounterpart(e.target.value)}
                placeholder="contato@email.com"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-subject" className="text-xs">
              Assunto
            </Label>
            <Input
              id="email-subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Assunto do e-mail"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-body" className="text-xs">
              Conteúdo
            </Label>
            <Textarea
              id="email-body"
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Conteúdo da troca de e-mail..."
              rows={3}
            />
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={handleLogEmail}
            disabled={
              logEmail.isPending ||
              !emailSubject.trim() ||
              !emailBody.trim()
            }
          >
            <Mail className="h-3.5 w-3.5 mr-1" />
            {logEmail.isPending ? "Registrando..." : "Registrar e-mail"}
          </Button>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Registro manual de um e-mail trocado fora do ONEmonday. Para enviar
            pelo sistema use &quot;Enviar e-mail&quot;.
          </p>
        </div>
      )}

      {managingChannel !== null && (
        <MessageTemplatesDialog
          open
          onOpenChange={(o) => !o && setManagingChannel(null)}
          sectorId={sectorId}
          channel={managingChannel}
        />
      )}
    </div>
  );
}
