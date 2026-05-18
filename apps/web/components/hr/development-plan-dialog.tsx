"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createDevelopmentPlan } from "@/lib/actions/hr/performance";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface DevelopmentPlanDialogProps {
  sectorId: string;
}

export function DevelopmentPlanDialog({ sectorId }: DevelopmentPlanDialogProps) {
  const queryClient = useQueryClient();
  const { data: employees } = useEmployees(sectorId);
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createDevelopmentPlan({
        sectorId,
        employeeId,
        title,
        objective,
        targetDate,
      }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Erro ao criar PDI"
        );
        return;
      }
      toast.success("Plano de desenvolvimento criado");
      queryClient.invalidateQueries({ queryKey: ["hr-development-plans"] });
      setEmployeeId("");
      setTitle("");
      setObjective("");
      setTargetDate("");
      setOpen(false);
    },
  });

  const activeEmployees = (employees ?? []).filter(
    (e: Employee) => e.status !== "terminated"
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4 mr-1" />
        Novo PDI
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo plano de desenvolvimento</DialogTitle>
            <DialogDescription>
              Crie um PDI para apoiar o crescimento de um colaborador.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Colaborador</Label>
              <Select value={employeeId} onValueChange={(v) => setEmployeeId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um colaborador">
                    {(value) =>
                      activeEmployees.find((e) => e.id === value)?.full_name ??
                      "Selecione um colaborador"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activeEmployees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pdi-title">Título</Label>
              <Input
                id="pdi-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Desenvolvimento de liderança"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pdi-objective">Objetivo</Label>
              <Textarea
                id="pdi-objective"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pdi-target">Prazo</Label>
              <Input
                id="pdi-target"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending || !employeeId}>
              {mutation.isPending ? "Criando..." : "Criar PDI"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
