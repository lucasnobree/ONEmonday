"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, AlertCircle, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { BoardCard as BoardCardType } from "@/hooks/use-board-data";

const priorityConfig = {
  critical: { label: "Critico", className: "border-l-red-500" },
  high: { label: "Alta", className: "border-l-orange-500" },
  medium: { label: "Media", className: "border-l-blue-500" },
  low: { label: "Baixa", className: "border-l-slate-400" },
};

interface BoardCardProps {
  card: BoardCardType;
  onClick?: () => void;
}

export function BoardCard({ card, onClick }: BoardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

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
        "rounded-lg border border-l-4 bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-foreground/20 transition-colors",
        priorityConfig[card.priority].className,
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
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

      <p className="text-sm font-medium leading-snug">{card.title}</p>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {card.cross_ref_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-violet-500">
              <ArrowRightLeft className="h-3 w-3" />
              {card.cross_ref_count}
            </span>
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
              {new Date(card.due_date).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              })}
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
