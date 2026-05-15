"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITY_CONFIG, formatDateFull } from "@/lib/constants";
import type { Priority } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { BoardData, BoardCard } from "@/hooks/use-board-data";

const priorityTextColors: Record<Priority, string> = {
  critical: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-green-500",
};

const priorityDotColors: Record<Priority, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

const priorityOrder: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

type SortField =
  | "title"
  | "column"
  | "priority"
  | "due_date"
  | "assignees"
  | "tags";
type SortDir = "asc" | "desc";

interface BoardListViewProps {
  board: BoardData;
  onCardClick: (cardId: string) => void;
}

export function BoardListView({ board, onCardClick }: BoardListViewProps) {
  const [sortField, setSortField] = useState<SortField>("column");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const allCards = useMemo(() => {
    const cards: (BoardCard & { columnName: string; columnColor: string | null; columnPosition: number })[] = [];
    for (const col of board.columns) {
      for (const card of col.cards) {
        cards.push({
          ...card,
          columnName: col.name,
          columnColor: col.color,
          columnPosition: col.position,
        });
      }
    }
    return cards;
  }, [board.columns]);

  const sortedCards = useMemo(() => {
    const sorted = [...allCards];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = a.title.localeCompare(b.title, "pt-BR");
          break;
        case "column":
          cmp = a.columnPosition - b.columnPosition;
          break;
        case "priority":
          cmp = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case "due_date": {
          const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          cmp = da - db;
          break;
        }
        case "assignees":
          cmp = a.assignees.length - b.assignees.length;
          break;
        case "tags":
          cmp = a.tags.length - b.tags.length;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [allCards, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        {sortedCards.length} {sortedCards.length === 1 ? "card" : "cards"}
      </p>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {(
                [
                  { field: "title" as SortField, label: "Titulo" },
                  { field: "column" as SortField, label: "Coluna" },
                  { field: "priority" as SortField, label: "Prioridade" },
                  { field: "due_date" as SortField, label: "Vencimento" },
                  { field: "assignees" as SortField, label: "Responsaveis" },
                  { field: "tags" as SortField, label: "Tags" },
                ] as const
              ).map(({ field, label }) => (
                <th
                  key={field}
                  className="px-4 py-2 text-left font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => handleSort(field)}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    <SortIcon field={field} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedCards.map((card) => (
              <tr
                key={card.id}
                onClick={() => onCardClick(card.id)}
                className="border-b last:border-b-0 cursor-pointer hover:bg-accent/50 transition-colors"
              >
                {/* Titulo */}
                <td className="px-4 py-3 font-medium max-w-[300px]">
                  <span className="line-clamp-1">{card.title}</span>
                </td>

                {/* Coluna */}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: card.columnColor ?? "#94a3b8" }}
                    />
                    <span className="whitespace-nowrap">{card.columnName}</span>
                  </span>
                </td>

                {/* Prioridade */}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full shrink-0",
                        priorityDotColors[card.priority]
                      )}
                    />
                    <span className={cn("whitespace-nowrap", priorityTextColors[card.priority])}>
                      {PRIORITY_CONFIG[card.priority].label}
                    </span>
                  </span>
                </td>

                {/* Vencimento */}
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {card.due_date
                    ? formatDateFull(card.due_date)
                    : "—"}
                </td>

                {/* Responsaveis */}
                <td className="px-4 py-3">
                  {card.assignees.length > 0 ? (
                    <div className="flex -space-x-1.5">
                      {card.assignees.slice(0, 3).map((a) => (
                        <Avatar
                          key={a.user_id}
                          size="sm"
                          className="border-2 border-background"
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
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>

                {/* Tags */}
                <td className="px-4 py-3">
                  {card.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
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
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
            {sortedCards.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum card neste board.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
