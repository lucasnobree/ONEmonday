"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Calendar,
  AlertCircle,
  Link2Off,
  FolderKanban,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  useProjectDetail,
  useUnlinkProjectCard,
  computeProjectProgress,
  isProjectOverdue,
  type ProjectCard,
} from "@/hooks/use-project-detail";
import { useCurrentSector } from "@/hooks/use-current-sector";
import { PermissionGate } from "@/components/shared/permission-gate";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { PRIORITY_CONFIG, formatDateFull } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ProjectLinkCardDialog } from "./project-link-card-dialog";

const STATUS_CONFIG = {
  active: {
    label: "Ativo",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  paused: {
    label: "Pausado",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  completed: {
    label: "Concluído",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  archived: {
    label: "Arquivado",
    className:
      "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
  },
} as const;

interface ProjectDetailProps {
  projectId: string;
  /** Sector slug used to build back/board links. */
  sectorSlug: string;
}

export function ProjectDetail({ projectId, sectorSlug }: ProjectDetailProps) {
  const { currentSector } = useCurrentSector();
  const { data: project, isLoading, error } = useProjectDetail(projectId);
  const unlinkCard = useUnlinkProjectCard(projectId);
  const [linkOpen, setLinkOpen] = useState(false);

  const progress = useMemo(
    () => computeProjectProgress(project?.cards ?? []),
    [project?.cards]
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="py-16 text-center">
        <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h2 className="mt-4 text-lg font-medium">Projeto não encontrado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O projeto pode ter sido removido ou você não tem acesso a ele.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          render={<Link href={`/${sectorSlug}/projects`} />}
        >
          Voltar para projetos
        </Button>
      </div>
    );
  }

  const statusCfg =
    STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] ??
    STATUS_CONFIG.active;
  const overdue = isProjectOverdue(project.status, project.target_date);

  async function handleUnlink(cardId: string) {
    const result = await unlinkCard.mutateAsync(cardId);
    if (result.error) {
      toast.error("Erro ao desvincular card", {
        description: String(result.error),
      });
      return;
    }
    toast.success("Card desvinculado");
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2"
          render={<Link href={`/${sectorSlug}/projects`} />}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Projetos
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.description && (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {project.description}
              </p>
            )}
          </div>
          {currentSector && (
            <PermissionGate
              sectorId={currentSector.id}
              resource="project"
              action="update"
            >
              <Button onClick={() => setLinkOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Vincular card
              </Button>
            </PermissionGate>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
          {(project.start_date || project.target_date) && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {project.start_date
                ? formatDateFull(project.start_date)
                : "—"}
              {" → "}
              {project.target_date
                ? formatDateFull(project.target_date)
                : "—"}
            </span>
          )}
          {overdue && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-500">
              <AlertCircle className="h-3.5 w-3.5" />
              Atrasado
            </span>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progresso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {progress.done} de {progress.total} cards concluídos
            </span>
            <span className="text-muted-foreground">{progress.percent}%</span>
          </div>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso do projeto"
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">
          Cards vinculados
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {project.cards.length}
          </span>
        </h2>
        {project.cards.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">Nenhum card vinculado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Vincule cards dos boards para acompanhar o trabalho do projeto.
            </p>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {project.cards.map((card) => (
              <ProjectCardRow
                key={card.id}
                card={card}
                sectorSlug={sectorSlug}
                onUnlink={() => handleUnlink(card.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <ProjectLinkCardDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        projectId={projectId}
        sectorIds={project.sectorIds}
        linkedCardIds={project.cards.map((c) => c.id)}
      />
    </div>
  );
}

interface ProjectCardRowProps {
  card: ProjectCard;
  sectorSlug: string;
  onUnlink: () => void;
}

function ProjectCardRow({ card, sectorSlug, onUnlink }: ProjectCardRowProps) {
  const { currentSector } = useCurrentSector();
  const isDone =
    card.completed_at != null || card.column?.is_done_column === true;
  const isOverdue =
    !isDone &&
    card.due_date != null &&
    new Date(card.due_date) < new Date();
  const priorityCfg = PRIORITY_CONFIG[card.priority];

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          card.priority === "critical" && "bg-red-500",
          card.priority === "high" && "bg-orange-500",
          card.priority === "medium" && "bg-yellow-500",
          card.priority === "low" && "bg-green-500"
        )}
        title={priorityCfg.label}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            isDone && "text-muted-foreground line-through"
          )}
        >
          {card.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {card.column && <span>{card.column.name}</span>}
          {card.due_date && (
            <span
              className={cn(
                "flex items-center gap-1",
                isOverdue && "text-red-500"
              )}
            >
              <Calendar className="h-3 w-3" />
              {formatDateFull(card.due_date)}
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Abrir board"
        render={<Link href={`/${sectorSlug}/boards/${card.board_id}`} />}
      >
        <ExternalLink className="h-4 w-4" />
      </Button>
      {currentSector && (
        <PermissionGate
          sectorId={currentSector.id}
          resource="project"
          action="update"
        >
          <ConfirmDialog
            title="Desvincular card"
            description="O card continuará existindo no board, apenas deixará de ser acompanhado neste projeto."
            onConfirm={onUnlink}
          >
            <Button variant="ghost" size="icon-sm" title="Desvincular">
              <Link2Off className="h-4 w-4" />
            </Button>
          </ConfirmDialog>
        </PermissionGate>
      )}
    </li>
  );
}
