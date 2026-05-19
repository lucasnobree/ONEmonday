"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { PRIORITY_CONFIG, formatDateFull } from "@/lib/constants";
import type { Priority } from "@/lib/constants";
import { PRIORITY_STATUS_COLOR, resolveStatusColor } from "@/lib/status-colors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { updateCard } from "@/lib/actions/cards";
import { StatusPill } from "./status-pill";
import {
  buildListGroups,
  summarizeGroup,
  countGroupedCards,
} from "./board-list-util";
import type { BoardData, BoardCard } from "@/hooks/use-board-data";

const PRIORITY_ORDER: Priority[] = ["critical", "high", "medium", "low"];

interface BoardListViewProps {
  board: BoardData;
  onCardClick: (cardId: string) => void;
}

/**
 * The Table/Main view: a group-banded grid. Each board column is a colored
 * Group band with a caret + colored name + item count, ~38px rows carrying
 * the group color on their left edge, a full-bleed Status (priority) cell,
 * an inline-editable item-name first cell, a `+ Add item` row and a summary
 * row of per-column aggregates — mirroring Monday's Main Table.
 */
export function BoardListView({ board, onCardClick }: BoardListViewProps) {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const groups = useMemo(() => buildListGroups(board), [board]);
  const totalCards = countGroupedCards(groups);

  function toggleGroup(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroupSelection(cards: BoardCard[], allSelected: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of cards) {
        if (allSelected) next.delete(c.id);
        else next.add(c.id);
      }
      return next;
    });
  }

  function startEditing(card: BoardCard) {
    setEditingId(card.id);
    setEditingTitle(card.title);
  }

  async function commitEditing() {
    if (!editingId) return;
    const next = editingTitle.trim();
    const card = groups
      .flatMap((g) => g.cards)
      .find((c) => c.id === editingId);
    if (!card || !next || next === card.title) {
      setEditingId(null);
      return;
    }
    setSavingId(editingId);
    const result = await updateCard({ id: editingId, title: next });
    setSavingId(null);
    setEditingId(null);
    if (result.error) {
      toast.error("Erro ao renomear item");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["board", board.id] });
  }

  if (totalCards === 0) {
    return (
      <div className="rounded-lg border py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum card neste board.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {totalCards} {totalCards === 1 ? "card" : "cards"}
      </p>

      {groups.map((group) => {
        const isCollapsed = collapsed[group.id] ?? false;
        const summary = summarizeGroup(group.cards);
        const bandColor = resolveStatusColor(group.color);
        const allSelected =
          group.cards.length > 0 &&
          group.cards.every((c) => selected.has(c.id));

        return (
          <div
            key={group.id}
            className="overflow-hidden rounded-lg border"
            style={{ borderLeft: `3px solid ${bandColor}` }}
          >
            {/* Group band header */}
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className="flex w-full items-center gap-2 bg-muted/40 px-3 py-2 text-left hover:bg-muted/60"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              <span
                className="text-sm font-semibold"
                style={{ color: bandColor }}
              >
                {group.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {group.cards.length}{" "}
                {group.cards.length === 1 ? "item" : "itens"}
              </span>
            </button>

            {!isCollapsed && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                    <th className="w-8 px-2 py-1.5">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar grupo ${group.name}`}
                        className="rounded"
                        checked={allSelected}
                        onChange={() =>
                          toggleGroupSelection(group.cards, allSelected)
                        }
                      />
                    </th>
                    <th className="px-3 py-1.5 text-left font-medium">Item</th>
                    <th className="w-40 px-3 py-1.5 text-center font-medium">
                      Status
                    </th>
                    <th className="w-44 px-3 py-1.5 text-left font-medium">
                      Responsáveis
                    </th>
                    <th className="w-32 px-3 py-1.5 text-left font-medium">
                      Vencimento
                    </th>
                    <th className="px-3 py-1.5 text-left font-medium">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {group.cards.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-2 text-xs text-muted-foreground"
                      >
                        Nenhum item neste grupo.
                      </td>
                    </tr>
                  )}
                  {group.cards.map((card) => {
                    const isSelected = selected.has(card.id);
                    return (
                      <tr
                        key={card.id}
                        className={cn(
                          "group/row h-9.5 border-b last:border-b-0 transition-colors",
                          isSelected
                            ? "bg-primary/5"
                            : "hover:bg-accent/40"
                        )}
                      >
                        {/* Checkbox */}
                        <td className="px-2 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${card.title}`}
                            className={cn(
                              "rounded transition-opacity",
                              !isSelected &&
                                "opacity-0 group-hover/row:opacity-100"
                            )}
                            checked={isSelected}
                            onChange={() => toggleRow(card.id)}
                          />
                        </td>

                        {/* Item name — inline editable */}
                        <td className="px-3">
                          {editingId === card.id ? (
                            <Input
                              value={editingTitle}
                              autoFocus
                              disabled={savingId === card.id}
                              onChange={(e) =>
                                setEditingTitle(e.target.value)
                              }
                              onBlur={commitEditing}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEditing();
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              className="h-7 text-sm"
                            />
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onCardClick(card.id)}
                                className="truncate font-medium hover:underline"
                              >
                                {card.title}
                              </button>
                              <button
                                type="button"
                                aria-label={`Renomear ${card.title}`}
                                onClick={() => startEditing(card)}
                                className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/row:opacity-100"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Status — full-bleed priority cell */}
                        <td className="p-0">
                          <StatusPill
                            mode="cell"
                            label={PRIORITY_CONFIG[card.priority].label}
                            color={PRIORITY_STATUS_COLOR[card.priority]}
                          />
                        </td>

                        {/* Responsáveis */}
                        <td className="px-3">
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

                        {/* Vencimento */}
                        <td className="px-3 whitespace-nowrap text-muted-foreground">
                          {card.due_date
                            ? formatDateFull(card.due_date)
                            : "—"}
                        </td>

                        {/* Tags */}
                        <td className="px-3">
                          {card.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
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
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Group summary row */}
                  {group.cards.length > 0 && (
                    <tr className="bg-muted/20 text-xs text-muted-foreground">
                      <td />
                      <td className="px-3 py-2 font-medium">Resumo</td>
                      <td className="px-3 py-2">
                        <div className="flex h-2 overflow-hidden rounded-full">
                          {PRIORITY_ORDER.filter(
                            (p) => summary.priorityCounts[p] > 0
                          ).map((p) => (
                            <div
                              key={p}
                              title={`${PRIORITY_CONFIG[p].label}: ${summary.priorityCounts[p]}`}
                              style={{
                                backgroundColor: PRIORITY_STATUS_COLOR[p],
                                flexGrow: summary.priorityCounts[p],
                              }}
                            />
                          ))}
                        </div>
                      </td>
                      <td colSpan={3} className="px-3 py-2">
                        {summary.total}{" "}
                        {summary.total === 1 ? "item" : "itens"}
                      </td>
                    </tr>
                  )}

                  {/* Add-item ghost row */}
                  <tr className="border-t">
                    <td />
                    <td colSpan={5} className="px-3 py-1.5">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar item na visão Kanban
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {/* Batch-action bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2 shadow-lg">
            <span className="text-sm font-medium">
              {selected.size} selecionado{selected.size === 1 ? "" : "s"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              <X className="h-4 w-4" />
              Limpar seleção
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
