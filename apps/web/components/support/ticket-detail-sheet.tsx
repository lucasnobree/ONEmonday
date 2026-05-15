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
  critical: "Critica",
  high: "Alta",
  medium: "Media",
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
  comment_added: "Comentario adicionado",
  status_changed: "Status alterado",
  priority_changed: "Prioridade alterada",
  assignee_added: "Responsavel adicionado",
  assignee_removed: "Responsavel removido",
  resolved: "Ticket resolvido",
  column_changed: "Coluna alterada",
  description_updated: "Descricao atualizada",
};

function formatSlaTime(dueAt: string | null, breached: boolean): {
  text: string;
  className: string;
} {
  if (breached) {
    return {
      text: "SLA Violado",
      className: "text-red-600 bg-red-50 font-semibold",
    };
  }

  if (!dueAt) {
    return { text: "N/A", className: "text-muted-foreground bg-muted" };
  }

  const now = new Date();
  const due = new Date(dueAt);
  const diffMs = due.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      text: "SLA Violado",
      className: "text-red-600 bg-red-50 font-semibold",
    };
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

  const totalHoursRemaining = diffMs / 3600000;
  let className: string;
  if (totalHoursRemaining > 4) {
    // > 50% remaining (green)
    className = "text-green-600 bg-green-50";
  } else if (totalHoursRemaining > 1) {
    // 25-50% remaining (yellow)
    className = "text-yellow-600 bg-yellow-50";
  } else {
    // < 25% remaining (red)
    className = "text-red-600 bg-red-50";
  }

  return { text, className };
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min atras`;
  if (hours < 24) return `${hours}h atras`;
  if (days < 7) return `${days}d atras`;
  return date.toLocaleDateString("pt-BR");
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
          Historico de Escalacao
        </h4>
        <div className="relative">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="relative pl-6">
                <div className="absolute left-0 top-1 size-[14px] rounded-full border-2 border-background bg-orange-500" />
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
  const slaResponse = formatSlaTime(
    ticket.sla_response_due_at,
    ticket.sla_response_breached
  );
  const slaResolve = formatSlaTime(
    ticket.sla_resolve_due_at,
    ticket.sla_resolve_breached
  );

  return (
    <div className="space-y-4">
      {/* Description */}
      {card?.description && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-1">
            Descricao
          </h4>
          <p className="text-sm whitespace-pre-wrap">{card.description}</p>
        </div>
      )}

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
          <span className="text-muted-foreground text-xs">SLA Resolucao</span>
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
      {card?.card_assignees && card.card_assignees.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">
              Responsaveis
            </h4>
            <div className="space-y-1">
              {card.card_assignees.map((a) => (
                <div
                  key={a.user_id}
                  className="flex items-center gap-2 text-sm"
                >
                  <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {(a.users?.full_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <span>{a.users?.full_name || a.users?.email || "---"}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Escalation Info */}
      {ticket.escalated_to_sector_id && (
        <>
          <Separator />
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="size-4 text-orange-500" />
              <h4 className="text-xs font-medium text-muted-foreground">
                Escalacao
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
          : "Erro ao adicionar comentario";
      toast.error(msg);
      return;
    }

    toast.success("Comentario adicionado");
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
            <p className="text-sm">Nenhum comentario ainda.</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">
                  {comment.users?.full_name || "Usuario"}
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
          placeholder="Escreva um comentario..."
          rows={2}
          className="flex-1 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={submitting || !content.trim()}
          title="Enviar comentario"
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
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

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
                className={`absolute left-0 top-1 size-[14px] rounded-full border-2 border-background ${dotColor}`}
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
              <p className="text-sm">Ticket nao encontrado.</p>
            </div>
          </div>
        ) : (
          <>
            <SheetHeader className="pr-8">
              <SheetTitle className="leading-snug">
                {ticket.card?.title || "Sem titulo"}
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
                {ticket.resolved_at ? (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  >
                    Resolvido
                  </Badge>
                ) : (
                  <Badge variant="secondary">Aberto</Badge>
                )}
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
                  Comentarios
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
