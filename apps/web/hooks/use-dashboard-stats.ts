"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface DashboardStats {
  totalCards: number;
  overdueCards: number;
  cardsThisWeek: number;
  completedThisWeek: number;
  activeProjects: number;
  cardsByPriority: { priority: string; count: number }[];
  cardsByColumn: { column_name: string; column_color: string; count: number }[];
}

export interface ColumnMeta {
  id: string;
  name: string;
  color: string | null;
}

const DEFAULT_COLUMN_COLOR = "#6b7280";

/**
 * Builds the "cards by column" chart data from per-column card counts and a
 * separately-fetched list of column metadata. Pure + exported for tests.
 *
 * Counts for columns missing from `columns` (e.g. a card whose column the
 * caller cannot resolve) are folded into a single "Outros" bucket so the
 * chart total always matches the real card count.
 */
export function buildCardsByColumn(
  countByColumnId: Map<string, number>,
  columns: ColumnMeta[]
): DashboardStats["cardsByColumn"] {
  const metaById = new Map(columns.map((c) => [c.id, c]));
  const byName = new Map<
    string,
    { column_name: string; column_color: string; count: number }
  >();
  let unresolved = 0;

  for (const [columnId, count] of countByColumnId) {
    if (count <= 0) continue;
    const meta = metaById.get(columnId);
    if (!meta) {
      unresolved += count;
      continue;
    }
    const existing = byName.get(meta.name);
    if (existing) {
      existing.count += count;
    } else {
      byName.set(meta.name, {
        column_name: meta.name,
        column_color: meta.color || DEFAULT_COLUMN_COLOR,
        count,
      });
    }
  }

  const result = Array.from(byName.values());
  if (unresolved > 0) {
    result.push({
      column_name: "Outros",
      column_color: DEFAULT_COLUMN_COLOR,
      count: unresolved,
    });
  }
  return result;
}

async function fetchDashboardStats(
  sectorId: string
): Promise<DashboardStats> {
  const supabase = createClient();

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const [
    totalRes,
    priorityRes,
    columnRes,
    overdueRes,
    weekRes,
    completedWeekRes,
    projectsRes,
  ] = await Promise.all([
    // Total active cards in sector
    supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("sector_id", sectorId)
      .eq("is_active", true),

    // Cards by priority
    supabase
      .from("cards")
      .select("priority")
      .eq("sector_id", sectorId)
      .eq("is_active", true),

    // Cards by column. We fetch only `column_id` here and resolve the column
    // name/colour from a separate sector-scoped query below. A `board_columns`
    // `!inner` join is filtered row-by-row by RLS and silently collapses to
    // zero for sector managers, so the chart must not depend on the join.
    supabase
      .from("cards")
      .select("column_id")
      .eq("sector_id", sectorId)
      .eq("is_active", true),

    // Overdue cards (due_date < now, active, not in done column)
    supabase
      .from("cards")
      .select("id, board_columns!inner(is_done_column)", {
        count: "exact",
        head: false,
      })
      .eq("sector_id", sectorId)
      .eq("is_active", true)
      .lt("due_date", now.toISOString().split("T")[0])
      .eq("board_columns.is_done_column", false),

    // Cards created this week
    supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("sector_id", sectorId)
      .eq("is_active", true)
      .gte("created_at", startOfWeek.toISOString()),

    // Cards completed this week (completed_at stamped by the DB trigger)
    supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("sector_id", sectorId)
      .eq("is_active", true)
      .gte("completed_at", startOfWeek.toISOString()),

    // Active projects in sector
    supabase
      .from("project_sectors")
      .select("projects!inner(id, is_active)")
      .eq("sector_id", sectorId)
      .eq("projects.is_active", true),
  ]);

  // Aggregate priority counts
  const priorityMap: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const card of priorityRes.data || []) {
    const p = card.priority as string;
    if (p in priorityMap) priorityMap[p]++;
  }
  const cardsByPriority = Object.entries(priorityMap).map(
    ([priority, count]) => ({ priority, count })
  );

  // Count cards per column id, then resolve names/colours from a separate
  // sector-scoped board_columns query (see the comment on columnRes above).
  const countByColumnId = new Map<string, number>();
  for (const card of columnRes.data ?? []) {
    const id = card.column_id as string | null;
    if (!id) continue;
    countByColumnId.set(id, (countByColumnId.get(id) ?? 0) + 1);
  }

  let columnsMeta: ColumnMeta[] = [];
  const columnIds = Array.from(countByColumnId.keys());
  if (columnIds.length > 0) {
    const { data: columnRows } = await supabase
      .from("board_columns")
      .select("id, name, color")
      .in("id", columnIds);
    columnsMeta = (columnRows ?? []) as ColumnMeta[];
  }
  const cardsByColumn = buildCardsByColumn(countByColumnId, columnsMeta);

  return {
    totalCards: totalRes.count ?? 0,
    overdueCards: overdueRes.data?.length ?? 0,
    cardsThisWeek: weekRes.count ?? 0,
    completedThisWeek: completedWeekRes.count ?? 0,
    activeProjects: projectsRes.data?.length ?? 0,
    cardsByPriority,
    cardsByColumn,
  };
}

export function useDashboardStats(sectorId: string | undefined) {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", sectorId],
    queryFn: () => fetchDashboardStats(sectorId!),
    enabled: !!sectorId,
    staleTime: 60 * 1000,
  });
}
