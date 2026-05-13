"use client";

import { useState } from "react";
import {
  Plus,
  FolderKanban,
  MoreHorizontal,
  Trash2,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { useProjects, useDeleteProject } from "@/hooks/use-projects";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { PermissionGate } from "@/components/shared/permission-gate";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCreateDialog } from "./project-create-dialog";

const STATUS_CONFIG = {
  active: { label: "Ativo", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  paused: { label: "Pausado", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  completed: { label: "Concluido", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  archived: { label: "Arquivado", className: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400" },
} as const;

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function ProjectList() {
  const { currentSector } = useCurrentSector();
  const { data: projects, isLoading } = useProjects(currentSector?.id);
  const deleteProject = useDeleteProject();
  const [createOpen, setCreateOpen] = useState(false);

  if (!currentSector) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FolderKanban className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h2 className="text-lg font-medium">Selecione um setor</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha um setor no menu lateral para ver seus projetos.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  async function handleDelete(projectId: string) {
    const result = await deleteProject.mutateAsync(projectId);
    if (result.error) {
      toast.error("Erro ao excluir projeto", {
        description: String(result.error),
      });
    } else {
      toast.success("Projeto excluido");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Projetos</h1>
          <p className="text-sm text-muted-foreground">{currentSector.name}</p>
        </div>
        <PermissionGate
          sectorId={currentSector.id}
          resource="project"
          action="create"
        >
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Projeto
          </Button>
        </PermissionGate>
      </div>

      {projects && projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-medium">Nenhum projeto</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Crie um projeto para comecar a organizar seus objetivos.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project: any) => {
            const statusCfg =
              STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] ??
              STATUS_CONFIG.active;
            const startFormatted = formatDate(project.start_date);
            const endFormatted = formatDate(project.target_date);

            return (
              <Card
                key={project.id}
                className="group hover:border-foreground/20 transition-colors"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base">
                        {project.name}
                      </CardTitle>
                      {project.description && (
                        <CardDescription className="line-clamp-2 mt-1">
                          {project.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <Badge className={statusCfg.className}>
                      {statusCfg.label}
                    </Badge>
                    {(startFormatted || endFormatted) && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {startFormatted && endFormatted
                          ? `${startFormatted} - ${endFormatted}`
                          : startFormatted || endFormatted}
                      </span>
                    )}
                  </div>
                  <CardAction>
                    <PermissionGate
                      sectorId={currentSector.id}
                      resource="project"
                      action="delete"
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="opacity-0 group-hover:opacity-100"
                            />
                          }
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleDelete(project.id)}
                            variant="destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </PermissionGate>
                  </CardAction>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      <ProjectCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
