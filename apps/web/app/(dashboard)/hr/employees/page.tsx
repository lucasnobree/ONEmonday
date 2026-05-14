"use client";

import { useState, useMemo } from "react";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useEmployees, type Employee } from "@/hooks/hr/use-employees";
import { EmployeeFormDialog } from "@/components/hr/employee-form-dialog";
import { EmployeeProfileSheet } from "@/components/hr/employee-profile-sheet";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
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

export default function EmployeesPage() {
  const { currentSector } = useCurrentSector();
  const { data: employees, isLoading } = useEmployees(currentSector?.id);
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const departments = useMemo(() => {
    const depts = new Set<string>();
    (employees ?? []).forEach((e: Employee) => {
      if (e.department) depts.add(e.department);
    });
    return Array.from(depts).sort();
  }, [employees]);

  const filtered = useMemo(() => {
    return (employees ?? []).filter((e: Employee) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (departmentFilter !== "all" && e.department !== departmentFilter)
        return false;
      return true;
    });
  }, [employees, statusFilter, departmentFilter]);

  if (!currentSector) {
    return (
      <p className="text-muted-foreground">
        Selecione um setor para ver os colaboradores.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="on_leave">Licenca</SelectItem>
              <SelectItem value="terminated">Desligado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v ?? "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os departamentos</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <EmployeeFormDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Colaboradores ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded bg-muted" />
              ))}
            </div>
          ) : !(employees ?? []).length ? (
            <EmptyState
              icon={Users}
              title="Nenhum colaborador cadastrado"
              description="Adicione seu primeiro colaborador para comecar a gerenciar sua equipe."
              action={<EmployeeFormDialog />}
            />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum colaborador encontrado com os filtros selecionados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Nome</th>
                    <th className="pb-2 font-medium">Cargo</th>
                    <th className="pb-2 font-medium">Departamento</th>
                    <th className="pb-2 font-medium">Admissao</th>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp: Employee) => {
                    const statusInfo = STATUS_MAP[emp.status] ?? {
                      label: emp.status,
                      variant: "secondary" as const,
                    };
                    return (
                      <tr
                        key={emp.id}
                        className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedEmployeeId(emp.id)}
                      >
                        <td className="py-2 font-medium">{emp.full_name}</td>
                        <td className="py-2">{emp.position}</td>
                        <td className="py-2">{emp.department ?? "-"}</td>
                        <td className="py-2">
                          {dateFormat.format(new Date(emp.hire_date))}
                        </td>
                        <td className="py-2">
                          {EMPLOYMENT_TYPE_MAP[emp.employment_type] ??
                            emp.employment_type}
                        </td>
                        <td className="py-2">
                          <Badge variant={statusInfo.variant}>
                            {statusInfo.label}
                          </Badge>
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

      <EmployeeProfileSheet
        employeeId={selectedEmployeeId}
        open={!!selectedEmployeeId}
        onOpenChange={(o) => !o && setSelectedEmployeeId(null)}
      />
    </div>
  );
}
