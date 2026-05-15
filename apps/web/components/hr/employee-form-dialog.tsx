"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEmployee, updateEmployee } from "@/lib/actions/hr/employees";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { useEmployees } from "@/hooks/hr/use-employees";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "CLT" },
  { value: "part_time", label: "Meio periodo" },
  { value: "contractor", label: "PJ" },
  { value: "intern", label: "Estagiario" },
];

interface EmployeeFormData {
  id: string;
  sectorId: string;
  fullName: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  hireDate: string;
  birthDate: string;
  managerId: string;
  employmentType: string;
}

interface EmployeeFormDialogProps {
  employee?: EmployeeFormData;
}

type EmployeeActionResult = {
  error?: string | Record<string, string[] | undefined>;
  data?: unknown;
  success?: boolean;
};

export function EmployeeFormDialog({ employee }: EmployeeFormDialogProps = {}) {
  const isEdit = !!employee;
  const { currentSector } = useCurrentSector();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(employee?.fullName ?? "");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const [position, setPosition] = useState(employee?.position ?? "");
  const [department, setDepartment] = useState(employee?.department ?? "");
  const [hireDate, setHireDate] = useState(employee?.hireDate ?? "");
  const [birthDate, setBirthDate] = useState(employee?.birthDate ?? "");
  const [managerId, setManagerId] = useState(employee?.managerId ?? "");
  const [employmentType, setEmploymentType] = useState(employee?.employmentType ?? "full_time");

  const sectorId = employee?.sectorId ?? currentSector?.id;
  const { data: coworkers } = useEmployees(open ? sectorId : undefined);
  const managerOptions = (coworkers ?? []).filter(
    (c) => c.id !== employee?.id && c.status !== "terminated"
  );

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const result = isEdit ? await updateEmployee(data) : await createEmployee(data);
      return result as EmployeeActionResult;
    },
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : isEdit ? "Erro ao atualizar colaborador" : "Erro ao criar colaborador"
        );
        return;
      }
      toast.success(isEdit ? "Colaborador atualizado com sucesso" : "Colaborador criado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
      queryClient.invalidateQueries({ queryKey: ["hr-employee-detail"] });
      queryClient.invalidateQueries({ queryKey: ["hr-stats"] });
      if (!isEdit) resetForm();
      setOpen(false);
    },
  });

  function resetForm() {
    setFullName("");
    setEmail("");
    setPhone("");
    setPosition("");
    setDepartment("");
    setHireDate("");
    setBirthDate("");
    setManagerId("");
    setEmploymentType("full_time");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sectorId) return;

    mutation.mutate({
      ...(isEdit ? { id: employee.id } : {}),
      sectorId,
      fullName,
      email,
      phone: phone || undefined,
      position,
      department,
      hireDate,
      birthDate: birthDate || undefined,
      managerId: managerId || undefined,
      employmentType,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={isEdit ? <Button variant="outline" className="w-full" /> : <Button size="sm" />}>
        {isEdit ? (
          <>
            <Pencil className="h-4 w-4 mr-2" />
            Editar Colaborador
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-1" />
            Novo Colaborador
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Atualize os dados do colaborador" : "Cadastre um novo colaborador no sistema"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome do colaborador"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@empresa.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="position">Cargo</Label>
                <Input
                  id="position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Ex: Analista"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="department">Departamento</Label>
                <Input
                  id="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Ex: TI"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="hireDate">Data de admissao</Label>
                <Input
                  id="hireDate"
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="birthDate">Data de nascimento</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo de contrato</Label>
                <Select
                  value={employmentType}
                  onValueChange={(v) => setEmploymentType(v ?? "full_time")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Gestor</Label>
                <Select
                  value={managerId || "none"}
                  onValueChange={(v) => setManagerId(v === "none" ? "" : v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sem gestor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem gestor</SelectItem>
                    {managerOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? isEdit ? "Salvando..." : "Criando..."
                : isEdit ? "Salvar" : "Criar Colaborador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
