"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/** A user eligible to be added to a project's roster. */
export interface ProjectMemberCandidate {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface CandidateRow {
  user_id: string;
  users: { id: string; full_name: string; avatar_url: string | null } | null;
}

/**
 * Distinct users with a role in any of the project's sectors — the pool the
 * "Adicionar membro" picker draws from. De-duplicated because a user may
 * hold a role in several of the project's sectors.
 */
export function useProjectMemberCandidates(sectorIds: string[] | undefined) {
  return useQuery<ProjectMemberCandidate[]>({
    queryKey: ["project-member-candidates", sectorIds],
    queryFn: async () => {
      if (!sectorIds || sectorIds.length === 0) return [];
      const supabase = createClient();

      const { data, error } = await supabase
        .from("user_sector_roles")
        .select("user_id, users(id, full_name, avatar_url)")
        .in("sector_id", sectorIds);
      if (error) throw error;

      const rows = (data ?? []) as unknown as CandidateRow[];
      const seen = new Set<string>();
      const candidates: ProjectMemberCandidate[] = [];
      for (const row of rows) {
        if (!row.users || seen.has(row.users.id)) continue;
        seen.add(row.users.id);
        candidates.push({
          id: row.users.id,
          full_name: row.users.full_name,
          avatar_url: row.users.avatar_url,
        });
      }
      return candidates.sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      );
    },
    enabled: !!sectorIds && sectorIds.length > 0,
  });
}
