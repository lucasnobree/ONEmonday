"use client";

import { useState } from "react";
import { useDealDetail } from "@/hooks/crm/use-deal-detail";
import { useActivities } from "@/hooks/crm/use-activities";
import { useCloseDealWon, useCloseDealLost } from "@/hooks/crm/use-deals";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Building2,
  User,
  Calendar,
  DollarSign,
  TrendingUp,
  Phone,
  Mail,
  Globe,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const priorityLabels: Record<string, string> = {
  critical: "Critica",
  high: "Alta",
  medium: "Media",
  low: "Baixa",
};

const activityTypeIcons: Record<string, { icon: typeof Phone; color: string }> = {
  call: { icon: Phone, color: "text-blue-500" },
  email: { icon: Mail, color: "text-green-500" },
  meeting: { icon: User, color: "text-purple-500" },
  note: { icon: FileText, color: "text-gray-500" },
  task: { icon: CheckCircle2, color: "text-yellow-500" },
};

const activityTypeLabels: Record<string, string> = {
  call: "Ligacao",
  email: "Email",
  meeting: "Reuniao",
  note: "Nota",
  task: "Tarefa",
};

const proposalStatusLabels: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  sent: { label: "Enviada", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  accepted: { label: "Aceita", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rejeitada", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

interface DealDetailSheetProps {
  dealId: string | null;
  sectorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DealDetailSheet({
  dealId,
  sectorId,
  open,
  onOpenChange,
}: DealDetailSheetProps) {
  const { data: deal, isLoading } = useDealDetail(dealId);
  const { data: activities } = useActivities({
    sectorId,
    dealId: dealId ?? undefined,
  });
  const closeDealWon = useCloseDealWon();
  const closeDealLost = useCloseDealLost();
  const [lostReason, setLostReason] = useState("");
  const [showLostForm, setShowLostForm] = useState(false);

  const handleWon = async () => {
    if (!dealId) return;
    const result = await closeDealWon.mutateAsync(dealId);
    if (result && "error" in result) {
      toast.error(typeof result.error === "string" ? result.error : "Erro ao fechar deal");
      return;
    }
    toast.success("Deal marcado como ganho!");
    onOpenChange(false);
  };

  const handleLost = async () => {
    if (!dealId || !lostReason.trim()) return;
    const result = await closeDealLost.mutateAsync({
      dealId,
      reason: lostReason,
    });
    if (result && "error" in result) {
      toast.error(typeof result.error === "string" ? result.error : "Erro ao fechar deal");
      return;
    }
    toast.success("Deal marcado como perdido");
    setLostReason("");
    setShowLostForm(false);
    onOpenChange(false);
  };

  const isClosed = deal?.actual_close_date != null;
  const isWon = isClosed && !deal?.lost_reason;
  const isLost = isClosed && !!deal?.lost_reason;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !deal ? (
          <div className="p-4 text-muted-foreground">Deal nao encontrado.</div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-start gap-2">
                <SheetTitle className="flex-1">
                  {deal.card.title}
                </SheetTitle>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="secondary"
                  className={priorityColors[deal.card.priority] || ""}
                >
                  {priorityLabels[deal.card.priority] || deal.card.priority}
                </Badge>
                <Badge
                  variant="secondary"
                  style={{
                    backgroundColor: deal.card.column.color + "20",
                    color: deal.card.column.color,
                    borderColor: deal.card.column.color + "40",
                  }}
                >
                  {deal.card.column.name}
                </Badge>
                {isWon && (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Ganho
                  </Badge>
                )}
                {isLost && (
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    Perdido
                  </Badge>
                )}
              </div>
              <SheetDescription>
                {deal.value != null && (
                  <span className="text-lg font-semibold text-foreground">
                    {formatCurrency(deal.value)}
                  </span>
                )}
              </SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="detalhes" className="px-4">
              <TabsList variant="line" className="w-full justify-start">
                <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                <TabsTrigger value="atividades">
                  Atividades ({activities?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="propostas">
                  Propostas ({deal.proposals.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="detalhes" className="mt-4 space-y-4">
                {deal.card.description && (
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {deal.card.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoItem
                    icon={DollarSign}
                    label="Valor"
                    value={deal.value != null ? formatCurrency(deal.value) : "—"}
                  />
                  <InfoItem
                    icon={TrendingUp}
                    label="Probabilidade"
                    value={
                      deal.win_probability != null
                        ? `${deal.win_probability}%`
                        : "—"
                    }
                  />
                  <InfoItem
                    icon={Calendar}
                    label="Fechamento previsto"
                    value={
                      deal.expected_close_date
                        ? dateFormat.format(new Date(deal.expected_close_date))
                        : "—"
                    }
                  />
                  <InfoItem
                    icon={Globe}
                    label="Fonte"
                    value={deal.source ?? "—"}
                  />
                  <InfoItem
                    icon={Clock}
                    label="Criado em"
                    value={dateFormat.format(new Date(deal.created_at))}
                  />
                  {deal.actual_close_date && (
                    <InfoItem
                      icon={Calendar}
                      label="Fechado em"
                      value={dateFormat.format(
                        new Date(deal.actual_close_date)
                      )}
                    />
                  )}
                </div>

                {deal.company && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" />
                        Empresa
                      </h4>
                      <p className="text-sm font-medium">
                        {deal.company.name}
                      </p>
                      {deal.company.industry && (
                        <p className="text-xs text-muted-foreground">
                          {deal.company.industry}
                        </p>
                      )}
                      {deal.company.domain && (
                        <p className="text-xs text-muted-foreground">
                          {deal.company.domain}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {deal.contact && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        Contato
                      </h4>
                      <p className="text-sm font-medium">
                        {deal.contact.full_name}
                      </p>
                      {deal.contact.position && (
                        <p className="text-xs text-muted-foreground">
                          {deal.contact.position}
                        </p>
                      )}
                      {deal.contact.email && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {deal.contact.email}
                        </p>
                      )}
                      {deal.contact.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {deal.contact.phone}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {deal.card.assignees.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Responsaveis</h4>
                      {deal.card.assignees.map((a) => (
                        <div
                          key={a.user_id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                            {a.user.full_name
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </div>
                          <span>{a.user.full_name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {isLost && deal.lost_reason && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium text-red-600">
                        Motivo da perda
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {deal.lost_reason}
                      </p>
                    </div>
                  </>
                )}

                {!isClosed && (
                  <>
                    <Separator />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={handleWon}
                        disabled={closeDealWon.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Marcar como Ganho
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => setShowLostForm(!showLostForm)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Marcar como Perdido
                      </Button>
                    </div>
                    {showLostForm && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Motivo da perda..."
                          value={lostReason}
                          onChange={(e) => setLostReason(e.target.value)}
                          rows={3}
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={handleLost}
                          disabled={
                            !lostReason.trim() || closeDealLost.isPending
                          }
                        >
                          Confirmar perda
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="atividades" className="mt-4">
                {!activities?.length ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nenhuma atividade registrada para este deal.
                  </p>
                ) : (
                  <div className="space-y-0 border-l-2 border-muted ml-3">
                    {activities.map((activity) => {
                      const typeInfo = activityTypeIcons[activity.type] || {
                        icon: FileText,
                        color: "text-gray-400",
                      };
                      const Icon = typeInfo.icon;
                      return (
                        <div key={activity.id} className="relative pl-6 pb-4">
                          <div
                            className={`absolute -left-[5px] top-1 h-2 w-2 rounded-full ${typeInfo.color} bg-current`}
                          />
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground uppercase">
                                {activityTypeLabels[activity.type] ||
                                  activity.type}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {dateFormat.format(
                                  new Date(activity.created_at)
                                )}
                              </span>
                            </div>
                            <p className="text-sm font-medium">
                              {activity.subject}
                            </p>
                            {activity.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {activity.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              por {activity.user?.full_name ?? "—"}
                              {activity.duration_min != null &&
                                ` · ${activity.duration_min}min`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="propostas" className="mt-4">
                {deal.proposals.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nenhuma proposta cadastrada para este deal.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {deal.proposals.map((proposal) => {
                      const statusInfo = proposalStatusLabels[proposal.status] || {
                        label: proposal.status,
                        className: "",
                      };
                      return (
                        <div
                          key={proposal.id}
                          className="border rounded-lg p-3 space-y-1"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">
                              {proposal.title}
                            </p>
                            <Badge
                              variant="secondary"
                              className={statusInfo.className}
                            >
                              {statusInfo.label}
                            </Badge>
                          </div>
                          <p className="text-sm font-semibold">
                            {formatCurrency(proposal.value)}
                          </p>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            {proposal.sent_at && (
                              <span>
                                Enviada:{" "}
                                {dateFormat.format(new Date(proposal.sent_at))}
                              </span>
                            )}
                            {proposal.expires_at && (
                              <span>
                                Expira:{" "}
                                {dateFormat.format(
                                  new Date(proposal.expires_at)
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
