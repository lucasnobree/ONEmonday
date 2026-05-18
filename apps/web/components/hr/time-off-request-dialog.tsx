"use client";

import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requestTimeOff } from "@/lib/actions/hr/time-off";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useEmployees, type Employee } from "@/hooks/hr/use-employees";
import { useTimeOffBalance } from "@/hooks/hr/use-time-off-balance";
import {
  checkTimeOffBalance,
  overBalanceMessage,
} from "@/lib/hr/time-off-balance";
import {
  useTimeOffPolicies,
  type TimeOffPolicy,
} from "@/hooks/hr/use-time-off-policies";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus } from "lucide-react";
import { toast } from "sonner";

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  const diff = e.getTime() - s.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
}

export function TimeOffRequestDialog() {
  const { currentSector } = useCurrentSector();
  const { data: employees } = useEmployees(currentSector?.id);
  const { data: policies } = useTimeOffPolicies(currentSector?.id);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  // Set true only after the user explicitly confirms an over-balance request.
  const [allowNegativeBalance, setAllowNegativeBalance] = useState(false);

  const daysCount = useMemo(() => calcDays(startDate, endDate), [startDate, endDate]);

  const activeEmployees = useMemo(
    () => (employees ?? []).filter((e: Employee) => e.status === "active"),
    [employees]
  );

  // Live balance preview for the chosen employee + policy, so the user is
  // warned before submitting a request that would push the balance negative.
  const balanceYear = startDate
    ? new Date(startDate).getFullYear()
    : new Date().getFullYear();
  const { data: balances } = useTimeOffBalance(
    employeeId || null,
    balanceYear
  );
  const selectedBalance = useMemo(
    () => balances?.find((b) => b.policy_id === policyId),
    [balances, policyId]
  );
  const balanceCheck = useMemo(() => {
    if (!selectedBalance || daysCount <= 0) return null;
    return checkTimeOffBalance(selectedBalance.available_days, daysCount);
  }, [selectedBalance, daysCount]);
  const overBalanceWarning = balanceCheck
    ? overBalanceMessage(balanceCheck)
    : null;

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => requestTimeOff(data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Erro ao criar solicitação"
        );
        return;
      }
      toast.success("Solicitação criada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["hr-time-off-requests"] });
      queryClient.invalidateQueries({ queryKey: ["hr-stats"] });
      resetForm();
      setOpen(false);
    },
  });

  function resetForm() {
    setEmployeeId("");
    setPolicyId("");
    setStartDate("");
    setEndDate("");
    setReason("");
    setAllowNegativeBalance(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentSector) return;

    mutation.mutate({
      employeeId,
      sectorId: currentSector.id,
      policyId,
      startDate,
      endDate,
      daysCount,
      reason,
      allowNegativeBalance,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4 mr-1" />
        Nova Solicitação
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova Solicitação de Férias</DialogTitle>
            <DialogDescription>
              Registre uma solicitação de férias ou ausência
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Colaborador</Label>
              <Select value={employeeId} onValueChange={(v) => setEmployeeId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {activeEmployees.map((emp: Employee) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Política</Label>
              <Select value={policyId} onValueChange={(v) => setPolicyId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a política" />
                </SelectTrigger>
                <SelectContent>
                  {(policies ?? []).map((policy: TimeOffPolicy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      {policy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {policies && policies.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhuma política de férias cadastrada para este setor.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Data de início</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate">Data de fim</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
            {daysCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Total: {daysCount} dia{daysCount > 1 ? "s" : ""}
                </span>
                {selectedBalance && (
                  <span className="text-muted-foreground">
                    Saldo disponível:{" "}
                    <span
                      className={
                        balanceCheck && !balanceCheck.withinBalance
                          ? "font-medium text-red-600"
                          : "font-medium text-foreground"
                      }
                    >
                      {selectedBalance.available_days}d
                    </span>
                  </span>
                )}
              </div>
            )}
            {overBalanceWarning && (
              <div className="rounded-md border border-red-200 bg-red-50/60 p-3 text-xs dark:border-red-900/30 dark:bg-red-900/10">
                <p className="font-medium text-red-700 dark:text-red-400">
                  {overBalanceWarning}
                </p>
                <label className="mt-2 flex items-center gap-2 text-red-700 dark:text-red-400">
                  <input
                    type="checkbox"
                    checked={allowNegativeBalance}
                    onChange={(e) => setAllowNegativeBalance(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  Aprovar mesmo assim (saldo ficará negativo)
                </label>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="reason">Motivo</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo da solicitação (opcional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                !employeeId ||
                !policyId ||
                (overBalanceWarning !== null && !allowNegativeBalance)
              }
            >
              {mutation.isPending ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
