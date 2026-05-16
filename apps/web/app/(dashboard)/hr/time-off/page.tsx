"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useCurrentSector } from "@/hooks/use-current-sector";
import {
  useTimeOffRequests,
  type TimeOffRequest,
} from "@/hooks/hr/use-time-off-requests";
import { useTimeOffBalance } from "@/hooks/hr/use-time-off-balance";
import { TimeOffRequestDialog } from "@/components/hr/time-off-request-dialog";
import { approveTimeOff, rejectTimeOff } from "@/lib/actions/hr/time-off";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
};

const STATUS_FILTER_LABELS: Record<string, string> = {
  all: "Todos",
  pending: "Pendentes",
  approved: "Aprovados",
  rejected: "Rejeitados",
};

function BalanceCell({ employeeId, policyId }: { employeeId: string; policyId: string }) {
  const currentYear = new Date().getFullYear();
  const { data: balances } = useTimeOffBalance(employeeId, currentYear);

  const balance = balances?.find((b) => b.policy_id === policyId);
  if (!balance) return <span className="text-muted-foreground">--</span>;

  const pct = balance.total_days > 0
    ? (balance.available_days / balance.total_days) * 100
    : 0;
  const colorClass = pct > 50
    ? "text-green-600"
    : pct > 25
    ? "text-yellow-600"
    : "text-red-600";

  return (
    <span className={`font-medium ${colorClass}`}>
      {balance.available_days}d
    </span>
  );
}

export default function TimeOffPage() {
  const { currentSector } = useCurrentSector();
  const { data: requests, isLoading } = useTimeOffRequests(currentSector?.id);
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [statusFilter, setStatusFilter] = useState(
    initialStatus && initialStatus in STATUS_FILTER_LABELS
      ? initialStatus
      : "all"
  );
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const filtered = useMemo(() => {
    if (!requests) return [];
    if (statusFilter === "all") return requests;
    return requests.filter((r: TimeOffRequest) => r.status === statusFilter);
  }, [requests, statusFilter]);

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveTimeOff(id),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string" ? result.error : "Erro ao aprovar"
        );
        return;
      }
      toast.success("Solicitação aprovada");
      queryClient.invalidateQueries({ queryKey: ["hr-time-off-requests"] });
      queryClient.invalidateQueries({ queryKey: ["hr-stats"] });
      queryClient.invalidateQueries({ queryKey: ["hr-time-off-balance"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectTimeOff(id, reason),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string" ? result.error : "Erro ao rejeitar"
        );
        return;
      }
      toast.success("Solicitação rejeitada");
      queryClient.invalidateQueries({ queryKey: ["hr-time-off-requests"] });
      queryClient.invalidateQueries({ queryKey: ["hr-stats"] });
      queryClient.invalidateQueries({ queryKey: ["hr-time-off-balance"] });
      closeRejectDialog();
    },
    onError: () => {
      toast.error("Erro ao rejeitar solicitação");
    },
  });

  function closeRejectDialog() {
    setRejectId(null);
    setRejectReason("");
  }

  function handleRejectSubmit() {
    if (!rejectId || !rejectReason.trim()) return;
    rejectMutation.mutate({ id: rejectId, reason: rejectReason.trim() });
  }

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para ver as solicitações.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status">
              {(value) => STATUS_FILTER_LABELS[value as string] ?? "Status"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
          </SelectContent>
        </Select>
        <TimeOffRequestDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Solicitações de Férias e Ausências
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded bg-muted" />
              ))}
            </div>
          ) : !filtered.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {statusFilter === "all"
                ? "Nenhuma solicitação encontrada."
                : "Nenhuma solicitação com o filtro selecionado."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Colaborador</th>
                    <th className="pb-2 font-medium">Período</th>
                    <th className="pb-2 font-medium">Dias</th>
                    <th className="pb-2 font-medium">Saldo</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((req: TimeOffRequest) => {
                    const statusInfo = STATUS_MAP[req.status] ?? {
                      label: req.status,
                      variant: "secondary" as const,
                    };
                    return (
                      <tr key={req.id} className="border-b last:border-0">
                        <td className="py-2">
                          <div>
                            <span className="font-medium">
                              {req.hr_employees.full_name}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {req.hr_employees.position}
                            </span>
                          </div>
                        </td>
                        <td className="py-2">
                          {dateFormat.format(new Date(req.start_date))} -{" "}
                          {dateFormat.format(new Date(req.end_date))}
                        </td>
                        <td className="py-2">{req.days_count}</td>
                        <td className="py-2">
                          <BalanceCell
                            employeeId={req.employee_id}
                            policyId={req.policy_id}
                          />
                        </td>
                        <td className="py-2">
                          <Badge variant={statusInfo.variant}>
                            {statusInfo.label}
                          </Badge>
                        </td>
                        <td className="py-2">
                          {req.status === "pending" && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => approveMutation.mutate(req.id)}
                                disabled={approveMutation.isPending}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  setRejectReason("");
                                  setRejectId(req.id);
                                }}
                                disabled={rejectMutation.isPending}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={rejectId !== null}
        onOpenChange={(o) => {
          if (!o) closeRejectDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição. O colaborador poderá visualizá-lo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="rejectReason">Motivo</Label>
            <Textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Descreva o motivo da rejeição"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRejectDialog}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
            >
              {rejectMutation.isPending ? "Rejeitando..." : "Rejeitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
