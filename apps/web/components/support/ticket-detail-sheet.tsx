"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useTicketDetail } from "@/hooks/support/use-ticket-detail";
import {
  resolveTicket,
  reopenTicket,
  markFirstResponse,
} from "@/lib/actions/support/tickets";
import { addTicketComment } from "@/lib/actions/support/comments";
import { EscalateTicketDialog } from "@/components/support/escalate-ticket-dialog";
import { TicketTagEditor } from "@/components/support/ticket-tag-editor";
import { TicketAssigneePicker } from "@/components/support/ticket-assignee-picker";
import { TicketStatusSelect } from "@/components/support/ticket-status-select";
import { TicketAttachments } from "@/components/support/ticket-attachments";
import { TICKET_STATUS_META } from "@/lib/support/status";
import { normalizeTicketStatus } from "@/lib/support/status";
import {
  isSlaPausedStatus,
  slaRemainingPct,
  slaPillPresentation,
} from "@/lib/support/sla";
import { formatRelativeTime } from "@/lib/support/format";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  Send,
  ArrowUpRight,
  RotateCcw,
  Reply,
} from "lucide-react";

interface TicketDetailSheetProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  medium:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const priorityLabels: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const channelLabels: Record<string, string> = {
  internal: "Interno",
  email: "Email",
  chat: "Chat",
  phone: "Telefone",
};

const activityDotColors: Record<string, string> = {
  card_created: "bg-green-500",
  comment_added: "bg-blue-500",
  status_changed: "bg-yellow-500",
  priority_changed: "bg-orange-500",
  assignee_added: "bg-purple-500",
  assignee_removed: "bg-red-500",
  resolved: "bg-green-600",
};

const activityLabels: Record<string, string> = {
  card_created: "Ticket criado",
  comment_added: "Comentário adicionado",
  status_changed: "Status alterado",
  priority_changed: "Prioridade alterada",
  assignee_added: "Responsável adicionado",
  assignee_removed: "Responsável removido",
  resolved: "Ticket resolvido",
  column_changed: "Coluna alterada",
  description_updated: "Descrição atualizada",
};

/**
 * SLA pill content for the detail sheet. Colour grading is delegated to the
 * shared percentage-based `slaPillPresentation` so the sheet and the ticket
 * queue use one consistent (dark-mode-aware) threshold model; the pill text
 * stays absolute ("4h 30m" remaining) for at-a-glance precision.
 */
function formatSlaTime(params: {
  createdAt: string;
  dueAt: string | null;
  breached: boolean;
}): { text: string; className: string } {
  const { createdAt, dueAt, breached } = params;
  const breachedPill = slaPillPresentation(0);

  if (breached) {
    return { text: "SLA Violado", className: breachedPill.className };
  }

  if (!dueAt) {
    return { text: "N/A", className: "text-muted-foreground bg-muted" };
  }

  const now = new Date();
  const diffMs = new Date(dueAt).getTime() - now.getTime();

  if (diffMs <= 0) {
    return { text: "SLA Violado", className: breachedPill.className };
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let text: string;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    text = `${days}d ${remHours}h`;
  } else {
    text = `${hours}h ${minutes}m`;
  }

  const pct = slaRemainingPct({ createdAt, deadlineAt: dueAt, at: now });
  // No computable window (e.g. zero-length) — fall back to a neutral pill.
  const className =
    pct === null
      ? "text-muted-foreground bg-muted"
      : slaPillPresentation(pct).className;

  return { text, className };
}

// -- Escalation History --
interface EscalationLogEntry {
  id: string;
  reason: string;
  created_at: string;
  from_sector: { name: string } | null;
  to_sector: { name: string } | null;
  user: { full_name: string } | null;
}

function EscalationHistory({ ticketId }: { ticketId: string }) {
  const supabase = createClient();
  const { data: logs } = useQuery<EscalationLogEntry[]>({
    queryKey: ["escalation-log", ticketId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_escalation_log")
        .select("*, from_sector:sectors!ticket_escalation_log_from_sector_id_fkey(name), to_sector:sectors!ticket_escalation_log_to_sector_id_fkey(name), user:users!ticket_escalation_log_escalated_by_fkey(full_name)")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      return (data || []) as unknown as EscalationLogEntry[];
    },
    enabled: !!ticketId,
  });

  if (!logs?.length) return null;

  return (
    <>
      <Separator />
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">
          Histórico de Escalação
        </h4>
        <div className="relative">
          <div className="absolute left-1.75 top-2 bottom-2 w-px bg-border" />
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="relative pl-6">
                <div className="absolute left-0 top-1 size-3.5 rounded-full border-2 border-background bg-orange-500" />
                <div className="space-y-0.5">
                  <p className="text-sm">
                    <span className="font-medium">{log.from_sector?.name}</span>
                    {" -> "}
                    <span className="font-medium">{log.to_sector?.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{log.reason}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{log.user?.full_name || "---"}</span>
                    <span>-</span>
                    <span>{formatRelativeTime(log.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// -- Details Tab --
function DetailsTab({
  ticket,
}: {
  ticket: NonNullable<ReturnType<typeof useTicketDetail>["data"]>;
}) {
  const card = ticket.card;
  const slaResponse = formatSlaTime({
    createdAt: ticket.created_at,
    dueAt: ticket.sla_response_due_at,
    breached: ticket.sla_response_breached,
  });
  const slaResolve = formatSlaTime({
    createdAt: ticket.created_at,
    dueAt: ticket.sla_resolve_due_at,
    breached: ticket.sla_resolve_breached,
  });

  return (
    <div className="space-y-4">
      {/* Description */}
      {card?.description && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1">
            Descrição
          </h4>
          <p className="text-sm whitespace-pre-wrap">{card.description}</p>
        </div>
      )}

      <Separator />

      {/* Status */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h4 className="text-xs font-medium text-muted-foreground">Status</h4>
          {isSlaPausedStatus(normalizeTicketStatus(ticket.status)) && (
            <span className="text-xs text-muted-foreground">SLA pausado</span>
          )}
        </div>
        <TicketStatusSelect
          ticketId={ticket.id}
          status={ticket.status}
          className="w-44"
        />
      </div>

      <Separator />

      {/* Tags */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">Tags</h4>
        <TicketTagEditor ticketId={ticket.id} sectorId={ticket.sector_id} />
      </div>

      <Separator />

      {/* Attachments */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">
          Anexos
        </h4>
        <TicketAttachments ticketId={ticket.id} />
      </div>

      <Separator />

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground text-xs">Categoria</span>
          <p className="font-medium">{ticket.category || "---"}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Subcategoria</span>
          <p className="font-medium">{ticket.subcategory || "---"}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Canal</span>
          <p className="font-medium capitalize">
            {ticket.channel ? channelLabels[ticket.channel] || ticket.channel : "---"}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Prioridade</span>
          <p>
            <Badge
              variant="secondary"
              className={priorityColors[card?.priority || ""] || ""}
            >
              {priorityLabels[card?.priority || ""] || card?.priority || "---"}
            </Badge>
          </p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Criado em</span>
          <p className="font-medium">
            {new Date(ticket.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Email solicitante</span>
          <p className="font-medium truncate">
            {ticket.requester_email || "---"}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">
            Primeira resposta
          </span>
          <p className="font-medium">
            {ticket.first_response_at
              ? new Date(ticket.first_response_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Pendente"}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">SLA Resposta</span>
          <p>
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${slaResponse.className}`}
            >
              <Clock className="size-3" />
              {slaResponse.text}
            </span>
          </p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">SLA Resolução</span>
          <p>
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${slaResolve.className}`}
            >
              <Clock className="size-3" />
              {slaResolve.text}
            </span>
          </p>
        </div>
      </div>

      {/* Assignees */}
      <Separator />
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">
          Responsáveis
        </h4>
        <TicketAssigneePicker
          ticketId={ticket.id}
          ticketCardId={ticket.card_id}
          sectorId={ticket.sector_id}
          assignees={(card?.card_assignees ?? []).map((a) => ({
            user_id: a.user_id,
            name: a.users?.full_name || a.users?.email || "---",
          }))}
        />
      </div>

      {/* Escalation Info */}
      {ticket.escalated_to_sector_id && (
        <>
          <Separator />
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="size-4 text-orange-500" />
              <h4 className="text-xs font-medium text-muted-foreground">
                Escalação
              </h4>
              <Badge
                variant="secondary"
                className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
              >
                Escalado
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Motivo</span>
                <p className="text-sm">{ticket.escalation_reason || "---"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Data</span>
                <p className="text-sm">
                  {ticket.escalated_at
                    ? new Date(ticket.escalated_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "---"}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Escalation History */}
      <EscalationHistory ticketId={ticket.id} />
    </div>
  );
}

// -- Comments Tab --
function CommentsTab({
  ticket,
}: {
  ticket: NonNullable<ReturnType<typeof useTicketDetail>["data"]>;
}) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const comments = (ticket.card?.card_comments || [])
    .filter((c) => c.is_active)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !ticket.card_id) return;

    setSubmitting(true);
    const result = await addTicketComment({
      cardId: ticket.card_id,
      content: content.trim(),
    });
    setSubmitting(false);

    if (result.error) {
      const msg =
        typeof result.error === "string"
          ? result.error
          : "Erro ao adicionar comentário";
      toast.error(msg);
      return;
    }

    toast.success("Comentário adicionado");
    setContent("");
    queryClient.invalidateQueries({
      queryKey: ["ticket-detail", ticket.card_id],
    });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-3 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <MessageSquare className="size-8 mb-2 opacity-50" />
            <p className="text-sm">Nenhum comentário ainda.</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">
                  {comment.users?.full_name || "Usuário"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(comment.created_at)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
            </div>
          ))
        )}
      </div>

      <Separator className="my-3" />

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva um comentário..."
          rows={2}
          className="flex-1 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={submitting || !content.trim()}
          title="Enviar comentário"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}

// -- Activity Tab --
function ActivityTab({
  ticket,
}: {
  ticket: NonNullable<ReturnType<typeof useTicketDetail>["data"]>;
}) {
  const activities = (ticket.card?.card_activity_log || []).sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Clock className="size-8 mb-2 opacity-50" />
        <p className="text-sm">Nenhuma atividade registrada.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-1.75 top-2 bottom-2 w-px bg-border" />

      <div className="space-y-4">
        {activities.map((activity) => {
          const dotColor =
            activityDotColors[activity.action] || "bg-gray-400";
          const label =
            activityLabels[activity.action] || activity.action;

          return (
            <div key={activity.id} className="relative pl-6">
              {/* Dot */}
              <div
                className={`absolute left-0 top-1 size-3.5 rounded-full border-2 border-background ${dotColor}`}
              />

              <div className="space-y-0.5">
                <p className="text-sm font-medium">{label}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{activity.users?.full_name || "Sistema"}</span>
                  <span>-</span>
                  <span>{formatRelativeTime(activity.created_at)}</span>
                </div>
                {activity.metadata &&
                  Object.keys(activity.metadata).length > 0 &&
                  (() => {
                    const meta = activity.metadata;
                    const from =
                      typeof meta.from === "string" ? meta.from : null;
                    const to = typeof meta.to === "string" ? meta.to : null;
                    const metaTitle =
                      typeof meta.title === "string" ? meta.title : null;
                    const text =
                      from && to ? `${from} -> ${to}` : metaTitle;
                    if (!text) return null;
                    return (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {text}
                      </p>
                    );
                  })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -- Main Sheet --
export function TicketDetailSheet({
  ticketId,
  open,
  onOpenChange,
}: TicketDetailSheetProps) {
  const { data: ticket, isLoading } = useTicketDetail(ticketId);
  const queryClient = useQueryClient();
  const [resolving, setResolving] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [markingResponse, setMarkingResponse] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);

  function invalidateTicket() {
    queryClient.invalidateQueries({ queryKey: ["ticket-detail", ticketId] });
    queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["sla-status"] });
  }

  async function handleResolve() {
    if (!ticket) return;
    setResolving(true);
    const result = await resolveTicket(ticket.id);
    setResolving(false);

    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao resolver"
      );
      return;
    }

    toast.success("Ticket resolvido");
    invalidateTicket();
  }

  async function handleReopen() {
    if (!ticket) return;
    setReopening(true);
    const result = await reopenTicket(ticket.id);
    setReopening(false);

    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao reabrir"
      );
      return;
    }

    toast.success("Ticket reaberto");
    invalidateTicket();
  }

  async function handleMarkFirstResponse() {
    if (!ticket) return;
    setMarkingResponse(true);
    const result = await markFirstResponse(ticket.id);
    setMarkingResponse(false);

    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao registrar resposta"
      );
      return;
    }

    toast.success("Primeira resposta registrada");
    invalidateTicket();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-lg flex flex-col overflow-hidden"
      >
        {isLoading ? (
          <div className="p-4 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Separator />
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ) : !ticket ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <AlertTriangle className="size-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Ticket não encontrado.</p>
            </div>
          </div>
        ) : (
          <>
            <SheetHeader className="pr-8">
              <SheetTitle className="leading-snug">
                {ticket.card?.title || "Sem título"}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Detalhes do ticket de suporte
              </SheetDescription>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="secondary"
                  className={priorityColors[ticket.card?.priority || ""] || ""}
                >
                  {priorityLabels[ticket.card?.priority || ""] ||
                    ticket.card?.priority}
                </Badge>
                <Badge
                  variant="secondary"
                  className={
                    TICKET_STATUS_META[normalizeTicketStatus(ticket.status)]
                      .badgeClass
                  }
                >
                  {
                    TICKET_STATUS_META[normalizeTicketStatus(ticket.status)]
                      .label
                  }
                </Badge>
                {ticket.escalated_to_sector_id && (
                  <Badge
                    variant="secondary"
                    className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                  >
                    Escalado
                  </Badge>
                )}
              </div>
            </SheetHeader>

            <Separator />

            <Tabs defaultValue="detalhes" className="flex-1 min-h-0 px-4">
              <TabsList className="w-full">
                <TabsTrigger value="detalhes" className="flex-1">
                  Detalhes
                </TabsTrigger>
                <TabsTrigger value="comentarios" className="flex-1">
                  Comentários
                </TabsTrigger>
                <TabsTrigger value="atividade" className="flex-1">
                  Atividade
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="detalhes"
                className="overflow-y-auto mt-4 pb-4"
              >
                <DetailsTab ticket={ticket} />
              </TabsContent>

              <TabsContent
                value="comentarios"
                className="overflow-y-auto mt-4 pb-4"
              >
                <CommentsTab ticket={ticket} />
              </TabsContent>

              <TabsContent
                value="atividade"
                className="overflow-y-auto mt-4 pb-4"
              >
                <ActivityTab ticket={ticket} />
              </TabsContent>
            </Tabs>

            {/* Footer actions */}
            <Separator />
            {ticket.resolved_at ? (
              <div className="p-4 pt-2">
                <Button
                  variant="outline"
                  onClick={handleReopen}
                  disabled={reopening}
                  className="w-full"
                >
                  <RotateCcw className="size-4 mr-2" />
                  {reopening ? "Reabrindo..." : "Reabrir Ticket"}
                </Button>
              </div>
            ) : (
              <div className="p-4 pt-2 space-y-2">
                {!ticket.first_response_at && (
                  <Button
                    variant="outline"
                    onClick={handleMarkFirstResponse}
                    disabled={markingResponse}
                    className="w-full"
                  >
                    <Reply className="size-4 mr-2" />
                    {markingResponse
                      ? "Registrando..."
                      : "Marcar primeira resposta"}
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEscalateOpen(true)}
                    className="flex-1"
                  >
                    <ArrowUpRight className="size-4 mr-2" />
                    Escalar
                  </Button>
                  <Button
                    onClick={handleResolve}
                    disabled={resolving}
                    className="flex-1"
                  >
                    <CheckCircle2 className="size-4 mr-2" />
                    {resolving ? "Resolvendo..." : "Resolver Ticket"}
                  </Button>
                </div>
              </div>
            )}

            {ticket && !ticket.resolved_at && (
              <EscalateTicketDialog
                open={escalateOpen}
                onOpenChange={setEscalateOpen}
                ticketId={ticket.id}
                currentSectorId={ticket.sector_id}
              />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
