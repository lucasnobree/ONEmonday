"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useUpdateProject } from "@/hooks/use-projects";
import type { ProjectSummary } from "@/hooks/use-projects";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { z } from "zod";

const PROJECT_STATUS_OPTIONS = [
  { value: "active", label: "Ativo" },
  { value: "paused", label: "Pausado" },
  { value: "completed", label: "Concluído" },
  { value: "archived", label: "Arquivado" },
] as const;

const editProjectSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(100),
  description: z.string().max(2000).optional(),
  status: z.enum(["active", "paused", "completed", "archived"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type EditProjectFormInput = z.infer<typeof editProjectSchema>;

interface ProjectEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectSummary;
}

/**
 * Edits a project's name, description, status and dates. The
 * `useUpdateProject` mutation already existed but had no UI entry point,
 * so a project could never legitimately move from "Ativo" to "Concluído".
 */
export function ProjectEditDialog({
  open,
  onOpenChange,
  project,
}: ProjectEditDialogProps) {
  const updateProject = useUpdateProject();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<EditProjectFormInput>({
    resolver: zodResolver(editProjectSchema),
    defaultValues: {
      name: project.name,
      description: project.description ?? "",
      status: project.status as EditProjectFormInput["status"],
      startDate: project.start_date ?? "",
      endDate: project.target_date ?? "",
    },
  });

  // Re-seed the form whenever a different project is opened.
  useEffect(() => {
    if (open) {
      reset({
        name: project.name,
        description: project.description ?? "",
        status: project.status as EditProjectFormInput["status"],
        startDate: project.start_date ?? "",
        endDate: project.target_date ?? "",
      });
    }
  }, [
    open,
    project.id,
    project.name,
    project.description,
    project.status,
    project.start_date,
    project.target_date,
    reset,
  ]);

  async function onSubmit(data: EditProjectFormInput) {
    const result = await updateProject.mutateAsync({
      id: project.id,
      name: data.name,
      description: data.description || undefined,
      status: data.status,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
    });

    if (result.error) {
      toast.error("Erro ao atualizar projeto", {
        description: String(result.error),
      });
      return;
    }

    toast.success("Projeto atualizado");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Projeto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-project-name">Nome</Label>
            <Input
              id="edit-project-name"
              placeholder="Ex: Redesign do portal"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-project-description">
              Descrição (opcional)
            </Label>
            <Textarea
              id="edit-project-description"
              placeholder="Descreva o objetivo deste projeto"
              {...register("description")}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value: string | null) => {
                    if (value) field.onChange(value);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.status && (
              <p className="text-sm text-destructive">
                {errors.status.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-project-start">Data de início</Label>
              <Input
                id="edit-project-start"
                type="date"
                {...register("startDate")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-end">Data alvo</Label>
              <Input
                id="edit-project-end"
                type="date"
                {...register("endDate")}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={updateProject.isPending}>
              {updateProject.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
