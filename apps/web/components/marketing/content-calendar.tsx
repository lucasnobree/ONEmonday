"use client";

import { useMemo } from "react";
import type { ContentItem } from "@/hooks/marketing/use-content-items";
import {
  buildMonthGrid,
  currentMonth,
  groupByDate,
  monthLabel,
  nextMonth,
  previousMonth,
} from "@/lib/marketing/calendar";
import { CHANNEL_COLORS } from "@/lib/marketing/labels";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface ContentCalendarProps {
  /** `YYYY-MM` anchor for the displayed month. */
  month: string;
  onMonthChange: (month: string) => void;
  items: ContentItem[];
  onSelectItem: (item: ContentItem) => void;
  onAddOnDate: (date: string) => void;
}

/** Editorial content calendar — a month grid of scheduled content items. */
export function ContentCalendar({
  month,
  onMonthChange,
  items,
  onSelectItem,
  onAddOnDate,
}: ContentCalendarProps) {
  const cells = useMemo(() => buildMonthGrid(month), [month]);
  const byDate = useMemo(() => groupByDate(items), [items]);
  const today = new Date().toISOString().slice(0, 10);
  const isCurrentMonth = month === currentMonth();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{monthLabel(month)}</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            aria-label="Mês anterior"
            onClick={() => onMonthChange(previousMonth(month))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isCurrentMonth}
            onClick={() => onMonthChange(currentMonth())}
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Próximo mês"
            onClick={() => onMonthChange(nextMonth(month))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-lg border bg-border overflow-hidden">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-muted px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {cells.map((cell) => {
          const dayItems = byDate.get(cell.date) ?? [];
          return (
            <div
              key={cell.date}
              className={`min-h-24 bg-background p-1.5 ${
                cell.inMonth ? "" : "opacity-40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium ${
                    cell.date === today
                      ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {cell.day}
                </span>
                {cell.inMonth && (
                  <button
                    type="button"
                    aria-label={`Adicionar conteúdo em ${cell.date}`}
                    onClick={() => onAddOnDate(cell.date)}
                    className="text-muted-foreground/60 hover:text-foreground"
                  >
                    <Plus className="size-3" />
                  </button>
                )}
              </div>
              <div className="mt-1 space-y-1">
                {dayItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectItem(item)}
                    className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] hover:bg-accent"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: CHANNEL_COLORS[item.channel] }}
                    />
                    <span className="truncate">{item.title}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
