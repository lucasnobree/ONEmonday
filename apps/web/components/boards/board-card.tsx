"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  AlertCircle,
  ArrowRightLeft,
  MessageSquare,
  MoreHorizontal,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITY_BORDER_COLORS, formatDateShort } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { StatusPill } from "./status-pill";
import type { BoardCard as BoardCardType } from "@/hooks/use-board-data";

interface BoardCardProps {
  card: BoardCardType;
  /** When true the card cannot be dragged (e.g. board filter active). */
  dragDisabled?: boolean;
  /** Status label shown as the card's compact pill — usually the column name. */
  statusLabel?: string;
  /** Status swatch hex for the pill; falsy renders the neutral grey swatch. */
  statusColor?: string | null;
  onClick?: () => void;
  /** Opens the item detail; wired to the hover `⋯` menu. */
  onOpen?: () => void;
}

export function BoardCard({
  card,
  dragDisabled = false,
  statusLabel,
  statusColor,
  onClick,
  onOpen,
}: BoardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, disabled: dragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue =
    card.due_date &&
    new Date(card.due_date) < new Date() &&
    card.priority !== "low";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "group/card relative rounded-lg border border-l-[3px] bg-card p-3 shadow-sm transition-colors",
        "hover:border-foreground/20 hover:shadow-md",
        dragDisabled
          ? "cursor-pointer"
          : "cursor-grab active:cursor-grabbing",
        PRIORITY_BORDER_COLORS[card.priority],
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      {/* Hover ⋯ menu — top-right corner */}
      <div
        className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Ações do card"
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              />
            }
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => (onOpen ?? onClick)?.()}>
              <ExternalLink className="h-4 w-4" />
              Abrir detalhes
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {card.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1 pr-7">
          {card.tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="rounded px-1.5 py-0 text-[10px]"
              style={{
                backgroundColor: tag.color + "20",
                color: tag.color,
              }}
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      <p className="pr-7 text-sm font-semibold leading-snug line-clamp-2">
        {card.title}
      </p>

      {/* Column values block */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {statusLabel && (
          <StatusPill mode="compact" label={statusLabel} color={statusColor} />
        )}
        {card.due_date && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs",
              isOverdue ? "text-red-500" : "text-muted-foreground"
            )}
          >
            {isOverdue && <AlertCircle className="h-3 w-3" />}
            <Calendar className="h-3 w-3" />
            {formatDateShort(card.due_date)}
          </span>
        )}
      </div>

      {/* Footer: updates/refs (left) + assignee avatars (right) */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {card.comment_count > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {card.comment_count}
            </span>
          )}
          {card.cross_ref_count > 0 && (
            <span className="flex items-center gap-1 text-violet-500">
              <ArrowRightLeft className="h-3 w-3" />
              {card.cross_ref_count}
            </span>
          )}
        </div>

        {card.assignees.length > 0 && (
          <div className="flex -space-x-1.5">
            {card.assignees.slice(0, 3).map((a) => (
              <Avatar
                key={a.user_id}
                className="h-6 w-6 border-2 border-background"
              >
                <AvatarFallback className="text-[10px]">
                  {a.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {card.assignees.length > 3 && (
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                +{card.assignees.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
