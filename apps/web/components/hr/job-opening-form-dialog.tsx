"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createJobOpening } from "@/lib/actions/hr/job-openings";
import { useCurrentSector } from "@/hooks/use-current-sector";
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

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "CLT" },
  { value: "part_time", label: "Meio periodo" },
  { value: "contractor", label: "PJ" },
  { value: "intern", label: "Estagiario" },
];

export function JobOpeningFormDialog() {
  const { currentSector } = useCurrentSector();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [employmentType, setEmploymentType] = useState("full_time");
  const [location, setLocation] = useState("");

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createJobOpening(data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Erro ao criar vaga"
        );
        return;
      }
      toast.success("Vaga criada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["hr-job-openings"] });
      queryClient.invalidateQueries({ queryKey: ["hr-stats"] });
      resetForm();
      setOpen(false);
    },
  });

  function resetForm() {
    setTitle("");
    setDepartment("");
    setDescription("");
    setRequirements("");
    setEmploymentType("full_time");
    setLocation("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentSector) return;

    mutation.mutate({
      sectorId: currentSector.id,
      title,
      department,
      description,
      requirements,
      employmentType,
      location,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4 mr-1" />
        Nova Vaga
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova Vaga</DialogTitle>
            <DialogDescription>
              Publique uma nova vaga para recrutamento
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Titulo da vaga</Label>
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
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Localizacao</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Remoto, Sao Paulo"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descricao</Label>
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
              {mutation.isPending ? "Criando..." : "Criar Vaga"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
