"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  FolderKanban,
  MoreHorizontal,
  Trash2,
  Pencil,
  Calendar,
  Search,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useProjects, useDeleteProject } from "@/hooks/use-projects";
import type { ProjectListItem } from "@/hooks/use-projects";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { isProjectOverdue } from "@/hooks/use-project-detail";
import { PermissionGate } from "@/components/shared/permission-gate";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCreateDialog } from "./project-create-dialog";
import { ProjectEditDialog } from "./project-edit-dialog";
import { sortProjects, type ProjectSortKey } from "./project-sort";

const STATUS_CONFIG = {
  active: { label: "Ativo", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  paused: { label: "Pausado", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  completed: { label: "Concluído", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  archived: { label: "Arquivado", className: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400" },
} as const;

const SORT_OPTIONS: { value: ProjectSortKey; label: string }[] = [
  { value: "recent", label: "Mais recentes" },
  { value: "name", label: "Nome (A-Z)" },
  { value: "progress", label: "Progresso" },
];

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ProjectList() {
  const { currentSector } = useCurrentSector();
  const { data: projects, isLoading } = useProjects(currentSector?.id);
  const deleteProject = useDeleteProject();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectListItem | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ProjectSortKey>("recent");

  const visibleProjects = useMemo(() => {
    if (!projects) return [];
    const query = search.trim().toLowerCase();
    const filtered = query
      ? projects.filter((p) => p.name.toLowerCase().includes(query))
      : projects;
    return sortProjects(filtered, sort);
  }, [projects, search, sort]);

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
          <Skeleton key={i} className="h-48 rounded-lg" />
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
      toast.success("Projeto excluído");
    }
  }

  const hasProjects = (projects?.length ?? 0) > 0;

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

      {!hasProjects ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-medium">Nenhum projeto</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Crie um projeto para começar a organizar seus objetivos.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-50">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar projetos por nome..."
                className="pl-8"
                aria-label="Buscar projetos"
              />
            </div>
            <Select
              value={sort}
              onValueChange={(v) => v && setSort(v as ProjectSortKey)}
            >
              <SelectTrigger className="w-48" aria-label="Ordenar projetos">
                <SelectValue>
                  {SORT_OPTIONS.find((opt) => opt.value === sort)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {visibleProjects.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum projeto corresponde à busca.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleProjects.map((project) => {
                const statusCfg =
                  STATUS_CONFIG[
                    project.status as keyof typeof STATUS_CONFIG
                  ] ?? STATUS_CONFIG.active;
                const startFormatted = formatDate(project.start_date);
                const endFormatted = formatDate(project.target_date);
                const overdue = isProjectOverdue(
                  project.status,
                  project.target_date
                );
                const percent =
                  project.cardCount === 0
                    ? 0
                    : Math.round(
                        (project.doneCount / project.cardCount) * 100
                      );

                return (
                  <Card
                    key={project.id}
                    className="group relative hover:border-foreground/20 transition-colors"
                  >
                    <CardHeader>
                      <Link
                        href={`/${currentSector.slug}/projects/${project.id}`}
                        className="contents"
                      >
                        <CardTitle className="text-base">
                          {project.name}
                        </CardTitle>
                        {project.description && (
                          <CardDescription className="line-clamp-2 mt-1">
                            {project.description}
                          </CardDescription>
                        )}
                      </Link>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <Badge className={statusCfg.className}>
                          {statusCfg.label}
                        </Badge>
                        {overdue && (
                          <span className="flex items-center gap-1 text-xs font-medium text-red-500">
                            <AlertCircle className="h-3 w-3" />
                            Atrasado
                          </span>
                        )}
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
                            <PermissionGate
                              sectorId={currentSector.id}
                              resource="project"
                              action="update"
                            >
                              <DropdownMenuItem
                                onClick={() => setEditingProject(project)}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                            </PermissionGate>
                            <PermissionGate
                              sectorId={currentSector.id}
                              resource="project"
                              action="delete"
                            >
                              <ConfirmDialog
                                title="Excluir projeto"
                                description={`Tem certeza que deseja excluir "${project.name}"? Esta ação não pode ser desfeita.`}
                                variant="destructive"
                                onConfirm={() => handleDelete(project.id)}
                              >
                                <DropdownMenuItem
                                  variant="destructive"
                                  closeOnClick={false}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              </ConfirmDialog>
                            </PermissionGate>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <Link
                        href={`/${currentSector.slug}/projects/${project.id}`}
                        className="block"
                      >
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {project.doneCount}/{project.cardCount} cards
                          </span>
                          <span>{percent}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <ProjectCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editingProject && (
        <ProjectEditDialog
          open={editingProject !== null}
          onOpenChange={(open) => {
            if (!open) setEditingProject(null);
          }}
          project={editingProject}
        />
      )}
    </div>
  );
}
