"use client";

import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requestTimeOff } from "@/lib/actions/hr/time-off";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useEmployees, type Employee } from "@/hooks/hr/use-employees";
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
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const daysCount = useMemo(() => calcDays(startDate, endDate), [startDate, endDate]);

  const activeEmployees = useMemo(
    () => (employees ?? []).filter((e: Employee) => e.status === "active"),
    [employees]
  );

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => requestTimeOff(data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Erro ao criar solicitacao"
        );
        return;
      }
      toast.success("Solicitacao criada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["hr-time-off-requests"] });
      queryClient.invalidateQueries({ queryKey: ["hr-stats"] });
      resetForm();
      setOpen(false);
    },
  });

  function resetForm() {
    setEmployeeId("");
    setStartDate("");
    setEndDate("");
    setReason("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentSector) return;

    mutation.mutate({
      employeeId,
      sectorId: currentSector.id,
      policyId: employeeId,
      startDate,
      endDate,
      daysCount,
      reason,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4 mr-1" />
        Nova Solicitacao
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova Solicitacao de Ferias</DialogTitle>
            <DialogDescription>
              Registre uma solicitacao de ferias ou ausencia
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Data de inicio</Label>
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
              <p className="text-sm text-muted-foreground">
                Total: {daysCount} dia{daysCount > 1 ? "s" : ""}
              </p>
            )}
            <div className="grid gap-2">
              <Label htmlFor="reason">Motivo</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo da solicitacao (opcional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending || !employeeId}>
              {mutation.isPending ? "Enviando..." : "Enviar Solicitacao"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
