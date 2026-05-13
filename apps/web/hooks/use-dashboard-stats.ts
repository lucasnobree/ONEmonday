"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface DashboardStats {
  totalCards: number;
  overdueCards: number;
  cardsThisWeek: number;
  activeProjects: number;
  cardsByPriority: { priority: string; count: number }[];
  cardsByColumn: { column_name: string; column_color: string; count: number }[];
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

    // Cards by column (need column name and color)
    supabase
      .from("cards")
      .select("column_id, board_columns!inner(name, color)")
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

  // Aggregate column counts
  const columnMap = new Map<
    string,
    { column_name: string; column_color: string; count: number }
  >();
  for (const card of columnRes.data || []) {
    const col = card.board_columns as any;
    const name = col.name as string;
    const color = (col.color as string) || "#6b7280";
    if (columnMap.has(name)) {
      columnMap.get(name)!.count++;
    } else {
      columnMap.set(name, { column_name: name, column_color: color, count: 1 });
    }
  }
  const cardsByColumn = Array.from(columnMap.values());

  return {
    totalCards: totalRes.count ?? 0,
    overdueCards: overdueRes.data?.length ?? 0,
    cardsThisWeek: weekRes.count ?? 0,
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
