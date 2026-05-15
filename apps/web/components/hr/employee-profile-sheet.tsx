"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmployeeDetail } from "@/hooks/hr/use-employee-detail";
import { terminateEmployee } from "@/lib/actions/hr/employees";
import {
  useOnboardingTemplates,
  useStartOnboarding,
} from "@/hooks/hr/use-onboarding";
import { useTimeOffBalance } from "@/hooks/hr/use-time-off-balance";
import { useEmployeeDocuments, useUploadDocument, useDeleteDocument } from "@/hooks/hr/use-employee-documents";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmployeeFormDialog } from "@/components/hr/employee-form-dialog";
import { getExpiryStatus } from "@/lib/hr/document-expiry";
import { Calendar, Clock, UserX, Users, Play, Upload, Trash2, Download, FileText } from "lucide-react";
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
                  <TabsTrigger value="docs">Documentos</TabsTrigger>
                  <TabsTrigger value="acoes">Acoes</TabsTrigger>
                </TabsList>

                <TabsContent value="perfil" className="mt-4">
                  <ProfileTab
                    employee={employee}
                    directReportsCount={directReportsCount}
                  />
                </TabsContent>

                <TabsContent value="ferias" className="mt-4">
                  <TimeOffTab
                    employeeId={employee.id}
                    timeOff={timeOff}
                    isLoading={isLoadingTimeOff}
                  />
                </TabsContent>

                <TabsContent value="docs" className="mt-4">
                  <DocumentsTab employee={employee} />
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
  employeeId,
  timeOff,
  isLoading,
}: {
  employeeId: string;
  timeOff: ReturnType<typeof useEmployeeDetail>["timeOff"];
  isLoading: boolean;
}) {
  const currentYear = new Date().getFullYear();
  const { data: balances, isLoading: loadingBalance } = useTimeOffBalance(
    employeeId,
    currentYear
  );

  return (
    <div className="space-y-4">
      {loadingBalance ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 rounded bg-muted animate-pulse" />
          ))}
        </div>
      ) : balances && balances.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {balances.map((b) => {
            const pct =
              b.total_days > 0 ? (b.available_days / b.total_days) * 100 : 0;
            const colorClass =
              pct > 50
                ? "border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-900/10"
                : pct > 25
                ? "border-yellow-200 bg-yellow-50/50 dark:border-yellow-900/30 dark:bg-yellow-900/10"
                : "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10";
            return (
              <div key={b.policy_id} className={`rounded-md border p-3 ${colorClass}`}>
                <p className="text-xs font-medium text-muted-foreground">
                  {b.policy_name}
                </p>
                <p className="text-lg font-bold">{b.available_days}d</p>
                <div className="text-xs text-muted-foreground space-x-2">
                  <span>Total: {b.total_days}</span>
                  <span>Usado: {b.used_days}</span>
                  {b.pending_days > 0 && <span>Pend.: {b.pending_days}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded bg-muted animate-pulse" />
          ))}
        </div>
      ) : timeOff.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium">Nenhuma solicitacao</p>
          <p className="text-xs text-muted-foreground">
            Este colaborador nao possui solicitacoes de ferias.
          </p>
        </div>
      ) : (
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
      )}
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
        <>
          <StartOnboardingButton employee={employee} />
          <TerminateEmployeeButton employee={employee} onOpenChange={onOpenChange} />
        </>
      )}
    </div>
  );
}

function StartOnboardingButton({
  employee,
}: {
  employee: NonNullable<ReturnType<typeof useEmployeeDetail>["employee"]>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const { data: templates } = useOnboardingTemplates(employee.sector_id);
  const startOnboarding = useStartOnboarding();
  const queryClient = useQueryClient();

  async function handleStart() {
    if (!selectedTemplate) return;
    const result = await startOnboarding.mutateAsync({
      employeeId: employee.id,
      templateId: selectedTemplate,
    });
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Erro ao iniciar onboarding"
      );
      return;
    }
    toast.success("Onboarding iniciado!");
    queryClient.invalidateQueries({ queryKey: ["hr-onboarding"] });
    setDialogOpen(false);
    setSelectedTemplate("");
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger
        render={<Button variant="outline" className="w-full" />}
      >
        <Play className="h-4 w-4 mr-2" />
        Iniciar Onboarding
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Iniciar Onboarding</DialogTitle>
          <DialogDescription>
            Selecione um template para iniciar o onboarding de{" "}
            <strong>{employee.full_name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label>Template</Label>
          <Select
            value={selectedTemplate}
            onValueChange={(v) => setSelectedTemplate(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um template" />
            </SelectTrigger>
            <SelectContent>
              {(templates ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(!templates || templates.length === 0) && (
            <p className="text-xs text-muted-foreground">
              Nenhum template disponivel. Crie um em Onboarding &gt; Templates.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleStart}
            disabled={
              startOnboarding.isPending ||
              !selectedTemplate
            }
          >
            {startOnboarding.isPending ? "Iniciando..." : "Iniciar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentsTab({
  employee,
}: {
  employee: NonNullable<ReturnType<typeof useEmployeeDetail>["employee"]>;
}) {
  const { data: documents, isLoading } = useEmployeeDocuments(employee.id);
  const uploadDoc = useUploadDocument();
  const deleteDoc = useDeleteDocument();

  const CATEGORY_MAP: Record<string, string> = {
    contract: "Contrato",
    id: "Documento",
    certificate: "Certificado",
    other: "Outro",
  };

  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("other");
  const [uploadExpiry, setUploadExpiry] = useState("");

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadDoc.mutateAsync({
        employeeId: employee.id,
        sectorId: employee.sector_id,
        file,
        category: uploadCategory,
        expiryDate: uploadExpiry || undefined,
      });
      if (result.error) {
        toast.error(
          typeof result.error === "string" ? result.error : "Erro ao enviar"
        );
      } else {
        toast.success("Documento enviado");
        setUploadExpiry("");
      }
    } catch {
      toast.error("Erro ao enviar documento");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Excluir este documento?")) return;
    const result = await deleteDoc.mutateAsync(docId);
    if (result.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Erro ao excluir"
      );
    } else {
      toast.success("Documento excluido");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-12 rounded bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const grouped = (documents ?? []).reduce<Record<string, typeof documents>>(
    (acc, doc) => {
      if (!doc) return acc;
      const cat = doc.category || "other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat]!.push(doc);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border p-3">
        <div className="flex items-center gap-2">
          <Select
            value={uploadCategory}
            onValueChange={(v) => setUploadCategory(v ?? "other")}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contract">Contrato</SelectItem>
              <SelectItem value="id">Documento</SelectItem>
              <SelectItem value="certificate">Certificado</SelectItem>
              <SelectItem value="other">Outro</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() =>
              document.getElementById("doc-upload-input")?.click()
            }
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            {uploading ? "Enviando..." : "Enviar"}
          </Button>
          <input
            id="doc-upload-input"
            type="file"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="doc-expiry" className="text-xs text-muted-foreground">
            Validade (opcional)
          </Label>
          <Input
            id="doc-expiry"
            type="date"
            value={uploadExpiry}
            onChange={(e) => setUploadExpiry(e.target.value)}
            className="h-8 w-40"
          />
        </div>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium">Nenhum documento</p>
          <p className="text-xs text-muted-foreground">
            Envie documentos do colaborador.
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([category, docs]) => (
          <div key={category} className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              {CATEGORY_MAP[category] ?? category}
            </p>
            {(docs ?? []).map((doc) => {
              const expiryStatus = getExpiryStatus(doc.expiry_date);
              return (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-md border p-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      {expiryStatus === "expired" && (
                        <Badge variant="destructive" className="text-[10px]">
                          Vencido
                        </Badge>
                      )}
                      {expiryStatus === "expiring" && (
                        <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">
                          Vence em breve
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dateFormat.format(new Date(doc.created_at))}
                      {doc.file_size
                        ? ` - ${(doc.file_size / 1024).toFixed(0)} KB`
                        : ""}
                      {doc.expiry_date
                        ? ` - Validade: ${dateFormat.format(new Date(doc.expiry_date))}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => window.open(doc.file_url, "_blank")}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
              );
            })}
          </div>
        ))
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
