"use client";

import { Search, X, Filter, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Priority } from "@/lib/constants";
import type { BoardCard, BoardData } from "@/hooks/use-board-data";

/** How the Kanban groups its cards into swimlanes. */
export type BoardGroupBy = "column" | "assignee" | "priority";

/** Due-date buckets the board can filter by. */
export type DueDateFilter = "all" | "overdue" | "today" | "week" | "none";

export interface BoardFilterState {
  /** Free-text query matched against card titles. */
  search: string;
  /** Priority filter; "all" disables it. */
  priority: Priority | "all";
  /** Assignee user ids; a card matches if it has any of them. Empty = off. */
  assignees: string[];
  /** Tag ids; a card matches if it has any of them. Empty = off. */
  tags: string[];
  /** Due-date bucket filter; "all" disables it. */
  dueDate: DueDateFilter;
}

export const EMPTY_BOARD_FILTERS: BoardFilterState = {
  search: "",
  priority: "all",
  assignees: [],
  tags: [],
  dueDate: "all",
};

/** True when any filter (other than group-by) is narrowing the board. */
export function isBoardFiltered(filters: BoardFilterState): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.priority !== "all" ||
    filters.assignees.length > 0 ||
    filters.tags.length > 0 ||
    filters.dueDate !== "all"
  );
}

/** Number of distinct active filter facets, for the "Filtros (N)" badge. */
export function activeFilterCount(filters: BoardFilterState): number {
  let n = 0;
  if (filters.priority !== "all") n += 1;
  if (filters.assignees.length > 0) n += 1;
  if (filters.tags.length > 0) n += 1;
  if (filters.dueDate !== "all") n += 1;
  return n;
}

/** True when `dueDate` (a date string or null) falls in the given bucket. */
export function dueDateMatches(
  dueDate: string | null,
  bucket: DueDateFilter,
  now: Date = new Date()
): boolean {
  if (bucket === "all") return true;
  if (bucket === "none") return dueDate == null;
  if (dueDate == null) return false;

  const due = new Date(dueDate);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  if (bucket === "overdue") return due.getTime() < startOfToday.getTime();
  if (bucket === "today") {
    return (
      due.getTime() >= startOfToday.getTime() &&
      due.getTime() < endOfToday.getTime()
    );
  }
  // "week" — within the next 7 days (today inclusive), not overdue.
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  return (
    due.getTime() >= startOfToday.getTime() &&
    due.getTime() < endOfWeek.getTime()
  );
}

/** True when the card passes the given filter state. Pure + exported for tests. */
export function cardMatchesFilters(
  card: Pick<
    BoardCard,
    "title" | "priority" | "due_date" | "assignees" | "tags"
  >,
  filters: BoardFilterState
): boolean {
  const query = filters.search.trim().toLowerCase();
  if (query && !card.title.toLowerCase().includes(query)) return false;
  if (filters.priority !== "all" && card.priority !== filters.priority) {
    return false;
  }
  if (filters.assignees.length > 0) {
    const ids = new Set(card.assignees.map((a) => a.user_id));
    if (!filters.assignees.some((id) => ids.has(id))) return false;
  }
  if (filters.tags.length > 0) {
    const ids = new Set(card.tags.map((t) => t.id));
    if (!filters.tags.some((id) => ids.has(id))) return false;
  }
  if (!dueDateMatches(card.due_date, filters.dueDate)) return false;
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
  { value: "critical", label: "Crítico" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Média" },
  { value: "low", label: "Baixa" },
];

const DUE_DATE_OPTIONS: { value: DueDateFilter; label: string }[] = [
  { value: "all", label: "Qualquer prazo" },
  { value: "overdue", label: "Atrasados" },
  { value: "today", label: "Vencem hoje" },
  { value: "week", label: "Próximos 7 dias" },
  { value: "none", label: "Sem prazo" },
];

const GROUP_BY_OPTIONS: { value: BoardGroupBy; label: string }[] = [
  { value: "column", label: "Coluna" },
  { value: "assignee", label: "Responsável" },
  { value: "priority", label: "Prioridade" },
];

/**
 * Maps a priority filter value to its human label. Used by the `SelectValue`
 * render so the trigger never shows the raw token (e.g. "all").
 */
export function priorityFilterLabel(value: BoardFilterState["priority"]): string {
  return (
    PRIORITY_OPTIONS.find((opt) => opt.value === value)?.label ??
    "Todas prioridades"
  );
}

/** Label for a group-by mode. */
export function groupByLabel(value: BoardGroupBy): string {
  return GROUP_BY_OPTIONS.find((o) => o.value === value)?.label ?? "Coluna";
}

/** A selectable assignee or tag option for the multi-select facets. */
export interface FacetOption {
  id: string;
  label: string;
}

interface BoardFiltersProps {
  filters: BoardFilterState;
  onChange: (filters: BoardFilterState) => void;
  groupBy: BoardGroupBy;
  onGroupByChange: (value: BoardGroupBy) => void;
  /** Distinct assignees present on the board, for the assignee facet. */
  assigneeOptions: FacetOption[];
  /** Distinct tags present on the board, for the tag facet. */
  tagOptions: FacetOption[];
  /** Number of cards after filtering, for the result count. */
  resultCount: number;
}

/** Toggles an id in/out of a string-id list. */
function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/**
 * Search + priority/assignee/tag/due-date filter bar plus a "Agrupar por"
 * (swimlanes) control, shared by the Kanban, List and Timeline views.
 */
export function BoardFilters({
  filters,
  onChange,
  groupBy,
  onGroupByChange,
  assigneeOptions,
  tagOptions,
  resultCount,
}: BoardFiltersProps) {
  const filtered = isBoardFiltered(filters);
  const facetCount = activeFilterCount(filters);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="relative min-w-50 flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Buscar cards por título..."
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
          <SelectValue>{priorityFilterLabel(filters.priority)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.dueDate}
        onValueChange={(v) =>
          onChange({ ...filters, dueDate: (v as DueDateFilter) ?? "all" })
        }
      >
        <SelectTrigger className="w-44" aria-label="Filtrar por prazo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DUE_DATE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" aria-label="Filtrar por responsável e tag" />
          }
        >
          <Filter className="h-4 w-4 mr-1" />
          Filtros
          {facetCount > 0 && (
            <Badge variant="secondary" className="ml-1.5">
              {facetCount}
            </Badge>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-3" align="end">
          <FacetSection
            title="Responsáveis"
            options={assigneeOptions}
            selected={filters.assignees}
            onToggle={(id) =>
              onChange({
                ...filters,
                assignees: toggleId(filters.assignees, id),
              })
            }
          />
          <FacetSection
            title="Tags"
            options={tagOptions}
            selected={filters.tags}
            onToggle={(id) =>
              onChange({ ...filters, tags: toggleId(filters.tags, id) })
            }
          />
        </PopoverContent>
      </Popover>

      <Select
        value={groupBy}
        onValueChange={(v) => v && onGroupByChange(v as BoardGroupBy)}
      >
        <SelectTrigger className="w-44" aria-label="Agrupar cards">
          <SelectValue>Agrupar: {groupByLabel(groupBy)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {GROUP_BY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {filtered && (
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

interface FacetSectionProps {
  title: string;
  options: FacetOption[];
  selected: string[];
  onToggle: (id: string) => void;
}

function FacetSection({
  title,
  options,
  selected,
  onToggle,
}: FacetSectionProps) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        {title}
      </p>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum disponível</p>
      ) : (
        <div className="max-h-40 space-y-0.5 overflow-y-auto">
          {options.map((opt) => {
            const checked = selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onToggle(opt.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    checked
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-input"
                  }`}
                >
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
