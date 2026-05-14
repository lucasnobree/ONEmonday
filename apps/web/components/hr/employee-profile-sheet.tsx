"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmployeeDetail } from "@/hooks/hr/use-employee-detail";
import { terminateEmployee } from "@/lib/actions/hr/employees";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmployeeFormDialog } from "@/components/hr/employee-form-dialog";
import { Calendar, Clock, UserX, Users } from "lucide-react";
import { toast } from "sonner";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  active: { label: "Ativo", variant: "default" },
  on_leave: { label: "Licenca", variant: "secondary" },
  terminated: { label: "Desligado", variant: "destructive" },
};

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  full_time: "CLT",
  part_time: "Meio periodo",
  contractor: "PJ",
  intern: "Estagiario",
};

const TIME_OFF_STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  approved: { label: "Aprovado", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  rejected: { label: "Rejeitado", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

interface EmployeeProfileSheetProps {
  employeeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeProfileSheet({
  employeeId,
  open,
  onOpenChange,
}: EmployeeProfileSheetProps) {
  const { employee, isLoadingEmployee, timeOff, isLoadingTimeOff, directReportsCount } =
    useEmployeeDetail(employeeId);

  const statusInfo = employee
    ? STATUS_MAP[employee.status] ?? { label: employee.status, variant: "secondary" as const }
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        {isLoadingEmployee || !employee ? (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  {getInitials(employee.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="truncate">{employee.full_name}</SheetTitle>
                  <p className="text-sm text-muted-foreground">{employee.position}</p>
                </div>
                {statusInfo && (
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                )}
              </div>
            </SheetHeader>

            <div className="px-4 pb-4">
              <Tabs defaultValue="perfil">
                <TabsList className="w-full">
                  <TabsTrigger value="perfil">Perfil</TabsTrigger>
                  <TabsTrigger value="ferias">Ferias</TabsTrigger>
                  <TabsTrigger value="acoes">Acoes</TabsTrigger>
                </TabsList>

                <TabsContent value="perfil" className="mt-4">
                  <ProfileTab
                    employee={employee}
                    directReportsCount={directReportsCount}
                  />
                </TabsContent>

                <TabsContent value="ferias" className="mt-4">
                  <TimeOffTab timeOff={timeOff} isLoading={isLoadingTimeOff} />
                </TabsContent>

                <TabsContent value="acoes" className="mt-4">
                  <ActionsTab employee={employee} onOpenChange={onOpenChange} />
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ProfileTab({
  employee,
  directReportsCount,
}: {
  employee: NonNullable<ReturnType<typeof useEmployeeDetail>["employee"]>;
  directReportsCount: number;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <InfoField label="Email" value={employee.email ?? "--"} />
        <InfoField label="Telefone" value={employee.phone ?? "--"} />
        <InfoField label="Departamento" value={employee.department ?? "--"} />
        <InfoField label="Cargo" value={employee.position} />
        <InfoField
          label="Tipo"
          value={EMPLOYMENT_TYPE_MAP[employee.employment_type] ?? employee.employment_type}
        />
        <InfoField
          label="Data de Admissao"
          value={dateFormat.format(new Date(employee.hire_date))}
        />
        {employee.birth_date && (
          <InfoField
            label="Data de Nascimento"
            value={dateFormat.format(new Date(employee.birth_date))}
          />
        )}
        <InfoField
          label="Gestor"
          value={employee.manager?.full_name ?? "--"}
        />
      </div>

      {directReportsCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border p-3 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Liderados diretos:</span>
          <span className="font-medium">{directReportsCount}</span>
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function TimeOffTab({
  timeOff,
  isLoading,
}: {
  timeOff: ReturnType<typeof useEmployeeDetail>["timeOff"];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (timeOff.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Calendar className="h-10 w-10 text-muted-foreground/50 mb-2" />
        <p className="text-sm font-medium">Nenhuma solicitacao</p>
        <p className="text-xs text-muted-foreground">
          Este colaborador nao possui solicitacoes de ferias.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {timeOff.map((req) => {
        const statusInfo = TIME_OFF_STATUS_MAP[req.status] ?? {
          label: req.status,
          variant: "outline" as const,
        };
        return (
          <div key={req.id} className="rounded-md border p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {req.policy?.name ?? "Ferias"}
              </span>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {dateFormat.format(new Date(req.start_date))} -{" "}
                {dateFormat.format(new Date(req.end_date))}
              </span>
              <span>({req.days_count} dias)</span>
            </div>
            {req.status === "rejected" && req.rejection_reason && (
              <p className="text-xs text-destructive">
                Motivo: {req.rejection_reason}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActionsTab({
  employee,
  onOpenChange,
}: {
  employee: NonNullable<ReturnType<typeof useEmployeeDetail>["employee"]>;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <EditEmployeeButton employee={employee} />
      {employee.status !== "terminated" && (
        <TerminateEmployeeButton employee={employee} onOpenChange={onOpenChange} />
      )}
    </div>
  );
}

function EditEmployeeButton({
  employee,
}: {
  employee: NonNullable<ReturnType<typeof useEmployeeDetail>["employee"]>;
}) {
  return (
    <EmployeeFormDialog
      employee={{
        id: employee.id,
        sectorId: employee.sector_id,
        fullName: employee.full_name,
        email: employee.email ?? "",
        phone: employee.phone ?? "",
        position: employee.position,
        department: employee.department ?? "",
        hireDate: employee.hire_date,
        birthDate: employee.birth_date ?? "",
        managerId: employee.manager_id ?? "",
        employmentType: employee.employment_type,
      }}
    />
  );
}

function TerminateEmployeeButton({
  employee,
  onOpenChange,
}: {
  employee: NonNullable<ReturnType<typeof useEmployeeDetail>["employee"]>;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [terminationDate, setTerminationDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const mutation = useMutation({
    mutationFn: () => terminateEmployee(employee.id, terminationDate),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string" ? result.error : "Erro ao desligar colaborador"
        );
        return;
      }
      toast.success("Colaborador desligado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
      queryClient.invalidateQueries({ queryKey: ["hr-employee-detail"] });
      queryClient.invalidateQueries({ queryKey: ["hr-stats"] });
      setConfirmOpen(false);
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogTrigger
        render={<Button variant="destructive" className="w-full" />}
      >
        <UserX className="h-4 w-4 mr-2" />
        Desligar Colaborador
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Desligar Colaborador</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja desligar{" "}
            <strong>{employee.full_name}</strong>? Esta acao ira alterar o
            status para desligado.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="terminationDate">Data de desligamento</Label>
          <Input
            id="terminationDate"
            type="date"
            value={terminationDate}
            onChange={(e) => setTerminationDate(e.target.value)}
            required
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !terminationDate}
          >
            {mutation.isPending ? "Desligando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
