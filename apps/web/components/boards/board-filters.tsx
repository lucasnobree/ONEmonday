"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Priority } from "@/lib/constants";
import type { BoardCard, BoardData } from "@/hooks/use-board-data";

export interface BoardFilterState {
  /** Free-text query matched against card titles. */
  search: string;
  /** Priority filter; "all" disables it. */
  priority: Priority | "all";
}

export const EMPTY_BOARD_FILTERS: BoardFilterState = {
  search: "",
  priority: "all",
};

/** True when the card passes the given filter state. Pure + exported for tests. */
export function cardMatchesFilters(
  card: Pick<BoardCard, "title" | "priority">,
  filters: BoardFilterState
): boolean {
  const query = filters.search.trim().toLowerCase();
  if (query && !card.title.toLowerCase().includes(query)) return false;
  if (filters.priority !== "all" && card.priority !== filters.priority) {
    return false;
  }
  return true;
}

/**
 * Returns a copy of the board with each column's cards filtered. Columns
 * are kept (empty columns still render) so the kanban layout is stable.
 */
export function applyBoardFilters(
  board: BoardData,
  filters: BoardFilterState
): BoardData {
  return {
    ...board,
    columns: board.columns.map((col) => ({
      ...col,
      cards: col.cards.filter((c) => cardMatchesFilters(c, filters)),
    })),
  };
}

/** Total card count across all columns of a board. */
export function countBoardCards(board: BoardData): number {
  return board.columns.reduce((sum, col) => sum + col.cards.length, 0);
}

const PRIORITY_OPTIONS: { value: Priority | "all"; label: string }[] = [
  { value: "all", label: "Todas prioridades" },
  { value: "critical", label: "Critico" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baixa" },
];

interface BoardFiltersProps {
  filters: BoardFilterState;
  onChange: (filters: BoardFilterState) => void;
  /** Number of cards after filtering, for the result count. */
  resultCount: number;
}

/**
 * Search + priority filter bar shared by the Kanban, List and Timeline
 * views. Boards become unusable past ~30 cards without this.
 */
export function BoardFilters({
  filters,
  onChange,
  resultCount,
}: BoardFiltersProps) {
  const isFiltered =
    filters.search.trim() !== "" || filters.priority !== "all";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Buscar cards por titulo..."
          className="pl-8"
          aria-label="Buscar cards"
        />
      </div>

      <Select
        value={filters.priority}
        onValueChange={(v) =>
          onChange({
            ...filters,
            priority: (v as BoardFilterState["priority"]) ?? "all",
          })
        }
      >
        <SelectTrigger className="w-44" aria-label="Filtrar por prioridade">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isFiltered && (
        <>
          <span className="text-sm text-muted-foreground">
            {resultCount} {resultCount === 1 ? "card" : "cards"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(EMPTY_BOARD_FILTERS)}
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        </>
      )}
    </div>
  );
}
