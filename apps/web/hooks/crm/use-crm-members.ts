"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/** A user with a role in the sector — a candidate deal/activity owner. */
export interface CrmMember {
  id: string;
  full_name: string;
  email: string;
}

interface SectorMemberRow {
  user_id: string;
  users: { id: string; full_name: string; email: string } | null;
}

/**
 * Distinct users with a role in the given sector. Populates the owner select
 * on deals and the assignee select on activities/tasks.
 */
export function useCrmMembers(sectorId: string | undefined) {
  return useQuery<CrmMember[]>({
    queryKey: ["crm-sector-members", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("user_sector_roles")
        .select("user_id, users(id, full_name, email)")
        .eq("sector_id", sectorId);

      if (error) throw error;

      const rows = (data ?? []) as unknown as SectorMemberRow[];
      const seen = new Set<string>();
      const members: CrmMember[] = [];
      for (const row of rows) {
        if (!row.users || seen.has(row.users.id)) continue;
        seen.add(row.users.id);
        members.push({
          id: row.users.id,
          full_name: row.users.full_name,
          email: row.users.email,
        });
      }
      return members.sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    enabled: !!sectorId,
  });
}
