"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/** A user that belongs to a sector — candidate contract owner / matter assignee. */
export interface LegalSectorMember {
  id: string;
  full_name: string;
  email: string;
}

interface SectorMemberRow {
  user_id: string;
  users: { id: string; full_name: string; email: string } | null;
}

/**
 * Distinct users with a role in the given sector. Used to populate the
 * owner select on contracts and the assignee select on matters.
 */
export function useSectorMembers(sectorId: string | undefined) {
  return useQuery<LegalSectorMember[]>({
    queryKey: ["legal-sector-members", sectorId],
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
      const members: LegalSectorMember[] = [];
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
