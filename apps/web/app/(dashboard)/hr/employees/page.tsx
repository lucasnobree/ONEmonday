"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useSectorScope } from "@/hooks/use-sector-scope";
import { SectorScopeFilter } from "@/components/shared/sector-scope-filter";
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
import { Users, Download, Search } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportToCSV } from "@/lib/utils/export-csv";

const dateFormat = new Intl.DateTimeFormat("pt-BR");

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  on_leave: { label: "Licença", variant: "secondary" },
  terminated: { label: "Desligado", variant: "destructive" },
};

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  full_time: "CLT",
  part_time: "Meio período",
  contractor: "PJ",
  intern: "Estagiário",
};

const STATUS_FILTER_LABELS: Record<string, string> = {
  all: "Todos os status",
  active: "Ativo",
  on_leave: "Licença",
  terminated: "Desligado",
};

export default function EmployeesPage() {
  const { scope, isLoading: scopeLoading } = useSectorScope();
  const { data: employees, isLoading: employeesLoading } = useEmployees(scope);
  const isLoading = scopeLoading || employeesLoading;
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [statusFilter, setStatusFilter] = useState(
    initialStatus && initialStatus in STATUS_FILTER_LABELS
      ? initialStatus
      : "all"
  );
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const departments = useMemo(() => {
    const depts = new Set<string>();
    (employees ?? []).forEach((e: Employee) => {
      if (e.department) depts.add(e.department);
    });
    return Array.from(depts).sort();
  }, [employees]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (employees ?? []).filter((e: Employee) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (departmentFilter !== "all" && e.department !== departmentFilter)
        return false;
      if (term) {
        const haystack = [e.full_name, e.email ?? "", e.position]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [employees, statusFilter, departmentFilter, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SectorScopeFilter />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, email ou cargo"
              className="w-64 pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Status">
                {(value) => STATUS_FILTER_LABELS[value as string] ?? "Status"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="on_leave">Licença</SelectItem>
              <SelectItem value="terminated">Desligado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v ?? "all")}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Departamento">
                {(value) =>
                  value === "all"
                    ? "Todos os departamentos"
                    : (value as string)
                }
              </SelectValue>
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportToCSV(
                filtered.map((e: Employee) => ({
                  nome: e.full_name,
                  email: e.email ?? "",
                  cargo: e.position,
                  departamento: e.department ?? "",
                  status: STATUS_MAP[e.status]?.label ?? e.status,
                  tipo: EMPLOYMENT_TYPE_MAP[e.employment_type] ?? e.employment_type,
                })),
                `colaboradores-${new Date().toISOString().split("T")[0]}`,
                [
                  { key: "nome", label: "Nome" },
                  { key: "email", label: "Email" },
                  { key: "cargo", label: "Cargo" },
                  { key: "departamento", label: "Departamento" },
                  { key: "status", label: "Status" },
                  { key: "tipo", label: "Tipo" },
                ]
              )
            }
            disabled={!filtered.length}
          >
            <Download className="size-4 mr-1" />
            Exportar
          </Button>
          <EmployeeFormDialog />
        </div>
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
              description="Adicione seu primeiro colaborador para começar a gerenciar sua equipe."
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
                    <th className="pb-2 font-medium">Admissão</th>
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
