"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createJobOpening,
  updateJobOpening,
} from "@/lib/actions/hr/job-openings";
import { useCurrentSector } from "@/hooks/use-current-sector";
import type { JobOpening } from "@/hooks/hr/use-job-openings";
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
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "CLT" },
  { value: "part_time", label: "Meio período" },
  { value: "contractor", label: "PJ" },
  { value: "intern", label: "Estagiário" },
];

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EMPLOYMENT_TYPES.map((t) => [t.value, t.label])
);

interface JobOpeningFormDialogProps {
  /** When set, the dialog edits this vaga; otherwise it creates a new one. */
  opening?: JobOpening;
  /**
   * Custom trigger element (e.g. an icon-only edit button). When omitted the
   * dialog renders the default "Nova Vaga" button.
   */
  trigger?: React.ReactElement;
}

/**
 * Create-or-edit dialog for a job opening (vaga). In edit mode the title,
 * description and other fields of an existing vaga become editable — the Wave
 * 4 audit flagged that a vaga could not be edited at all.
 */
export function JobOpeningFormDialog({
  opening,
  trigger,
}: JobOpeningFormDialogProps) {
  const { currentSector } = useCurrentSector();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="sm" />}>
        {trigger ? (
          <Pencil className="h-4 w-4" />
        ) : (
          <>
            <Plus className="h-4 w-4 mr-1" />
            Nova Vaga
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {/* Remount the form per vaga so useState initialisers reset the
            fields — no setState-in-effect. */}
        <JobOpeningForm
          key={opening?.id ?? "new"}
          opening={opening}
          sectorId={currentSector?.id ?? null}
          onClose={() => setOpen(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["hr-job-openings"] });
            queryClient.invalidateQueries({ queryKey: ["hr-stats"] });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

interface JobOpeningFormProps {
  opening?: JobOpening;
  sectorId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function JobOpeningForm({
  opening,
  sectorId,
  onClose,
  onSaved,
}: JobOpeningFormProps) {
  const isEdit = !!opening;
  const [title, setTitle] = useState(opening?.title ?? "");
  const [department, setDepartment] = useState(opening?.department ?? "");
  const [description, setDescription] = useState(opening?.description ?? "");
  const [requirements, setRequirements] = useState(
    opening?.requirements ?? ""
  );
  const [employmentType, setEmploymentType] = useState(
    opening?.employment_type ?? "full_time"
  );
  const [location, setLocation] = useState(opening?.location ?? "");
  const [salaryRange, setSalaryRange] = useState(opening?.salary_range ?? "");

  const mutation = useMutation({
    mutationFn: async (): Promise<{ error?: unknown }> => {
      if (isEdit) {
        return updateJobOpening({
          openingId: opening!.id,
          title,
          department,
          description,
          requirements,
          employmentType,
          location,
          salaryRange,
        });
      }
      return createJobOpening({
        sectorId,
        title,
        department,
        description,
        requirements,
        employmentType,
        location,
        salaryRange,
      });
    },
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : isEdit
              ? "Erro ao atualizar vaga"
              : "Erro ao criar vaga"
        );
        return;
      }
      toast.success(isEdit ? "Vaga atualizada" : "Vaga criada com sucesso");
      onSaved();
      onClose();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && !sectorId) return;
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar Vaga" : "Nova Vaga"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Atualize os dados da vaga de recrutamento"
            : "Publique uma nova vaga para recrutamento"}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="title">Título da vaga</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Desenvolvedor Full Stack"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="department">Departamento</Label>
            <Input
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Ex: Tecnologia"
            />
          </div>
          <div className="grid gap-2">
            <Label>Tipo de contrato</Label>
            <Select
              value={employmentType}
              onValueChange={(v) => setEmploymentType(v ?? "full_time")}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value) =>
                    EMPLOYMENT_TYPE_LABELS[value as string] ?? "CLT"
                  }
                </SelectValue>
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
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="location">Localização</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: Remoto, São Paulo"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="salary">Faixa salarial</Label>
            <Input
              id="salary"
              value={salaryRange}
              onChange={(e) => setSalaryRange(e.target.value)}
              placeholder="Ex: R$ 5.000 - R$ 7.000"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva a vaga"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="requirements">Requisitos</Label>
          <Textarea
            id="requirements"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="Liste os requisitos da vaga"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? "Salvando..."
            : isEdit
              ? "Salvar alterações"
              : "Criar Vaga"}
        </Button>
      </DialogFooter>
    </form>
  );
}
