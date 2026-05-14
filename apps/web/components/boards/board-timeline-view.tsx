"use client";

import { useMemo, useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  format,
  differenceInDays,
  isSameWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PRIORITY_CONFIG } from "@/lib/constants";
import type { Priority } from "@/lib/constants";
import type { BoardData, BoardCard } from "@/hooks/use-board-data";

const priorityBgColors: Record<Priority, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

interface BoardTimelineViewProps {
  board: BoardData;
  onCardClick: (cardId: string) => void;
}

export function BoardTimelineView({ board, onCardClick }: BoardTimelineViewProps) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const cardsWithDates = useMemo(() => {
    const cards: (BoardCard & { columnName: string })[] = [];
    for (const col of board.columns) {
      for (const card of col.cards) {
        if (card.due_date) {
          cards.push({ ...card, columnName: col.name });
        }
      }
    }
    cards.sort(
      (a, b) =>
        new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()
    );
    return cards;
  }, [board.columns]);

  const { weeks, timelineStart, totalDays } = useMemo(() => {
    if (cardsWithDates.length === 0) {
      return { weeks: [], timelineStart: new Date(), totalDays: 0 };
    }

    const dates = cardsWithDates.map((c) => new Date(c.due_date!));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    const start = startOfWeek(addWeeks(minDate, -1), { locale: ptBR });
    const end = endOfWeek(addWeeks(maxDate, 1), { locale: ptBR });

    const totalD = differenceInDays(end, start) + 1;

    const wks: { start: Date; end: Date; label: string }[] = [];
    let current = start;
    while (current <= end) {
      const weekEnd = endOfWeek(current, { locale: ptBR });
      wks.push({
        start: new Date(current),
        end: weekEnd > end ? end : weekEnd,
        label: format(current, "dd MMM", { locale: ptBR }),
      });
      current = addWeeks(current, 1);
    }

    return { weeks: wks, timelineStart: start, totalDays: totalD };
  }, [cardsWithDates]);

  if (cardsWithDates.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">
          Nenhum card possui data de vencimento para exibir no timeline.
        </p>
      </div>
    );
  }

  const COL_WIDTH = 120;
  const ROW_HEIGHT = 40;
  const BAR_HEIGHT = 28;

  return (
    <div className="overflow-x-auto">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `200px repeat(${weeks.length}, ${COL_WIDTH}px)`,
          minWidth: `${200 + weeks.length * COL_WIDTH}px`,
        }}
      >
        {/* Header row */}
        <div className="sticky left-0 z-10 bg-background border-b border-r px-3 py-2 text-sm font-medium text-muted-foreground">
          Card
        </div>
        {weeks.map((week, i) => (
          <div
            key={i}
            className={cn(
              "border-b px-2 py-2 text-xs font-medium text-muted-foreground text-center",
              isSameWeek(new Date(), week.start, { locale: ptBR }) &&
                "bg-primary/5"
            )}
          >
            {week.label}
          </div>
        ))}

        {/* Card rows */}
        {cardsWithDates.map((card) => {
          const dueDate = new Date(card.due_date!);
          const dayOffset = differenceInDays(dueDate, timelineStart);
          const weekIndex = Math.floor(dayOffset / 7);
          const dayInWeek = dayOffset % 7;
          const leftPx = dayInWeek * (COL_WIDTH / 7);

          return (
            <div key={card.id} className="contents">
              {/* Card name column */}
              <div
                className="sticky left-0 z-10 bg-background border-b border-r px-3 flex items-center cursor-pointer hover:bg-accent/50 transition-colors"
                style={{ height: ROW_HEIGHT }}
                onClick={() => onCardClick(card.id)}
              >
                <span className="text-sm truncate">{card.title}</span>
              </div>

              {/* Timeline cells */}
              {weeks.map((week, wi) => (
                <div
                  key={wi}
                  className={cn(
                    "border-b relative",
                    isSameWeek(new Date(), week.start, { locale: ptBR }) &&
                      "bg-primary/5"
                  )}
                  style={{ height: ROW_HEIGHT }}
                >
                  {wi === weekIndex && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2"
                      style={{ left: leftPx }}
                    >
                      <div
                        className={cn(
                          "rounded px-2 py-1 text-[11px] font-medium text-white cursor-pointer whitespace-nowrap transition-opacity",
                          priorityBgColors[card.priority],
                          hoveredCard === card.id && "opacity-80"
                        )}
                        style={{ height: BAR_HEIGHT, lineHeight: `${BAR_HEIGHT - 8}px` }}
                        onClick={() => onCardClick(card.id)}
                        onMouseEnter={() => setHoveredCard(card.id)}
                        onMouseLeave={() => setHoveredCard(null)}
                        title={`${card.title} — ${format(dueDate, "dd/MM/yyyy")} — ${PRIORITY_CONFIG[card.priority].label}`}
                      >
                        {format(dueDate, "dd/MM")}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        {(Object.entries(PRIORITY_CONFIG) as [BoardCard["priority"], (typeof PRIORITY_CONFIG)[BoardCard["priority"]]][]).map(
          ([key, config]) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-full", priorityBgColors[key])} />
              {config.label}
            </span>
          )
        )}
      </div>
    </div>
  );
}
