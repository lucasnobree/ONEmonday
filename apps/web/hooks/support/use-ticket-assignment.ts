"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { assignTicket, unassignTicket } from "@/lib/actions/support/assign";

export interface SectorMember {
  id: string;
  full_name: string;
  email: string;
}

interface SectorMemberRow {
  user_id: string;
  users: { id: string; full_name: string; email: string } | null;
}

// Distinct users that belong to a sector (candidate ticket assignees).
export function useSectorMembers(sectorId: string | undefined) {
  return useQuery<SectorMember[]>({
    queryKey: ["sector-members", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("user_sector_roles")
        .select("user_id, users(id, full_name, email)")
        .eq("sector_id", sectorId);

      const rows = (data || []) as unknown as SectorMemberRow[];
      const seen = new Set<string>();
      const members: SectorMember[] = [];
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

function useAssignmentInvalidation() {
  const queryClient = useQueryClient();
  return (ticketCardId?: string | null) => {
    queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    if (ticketCardId) {
      queryClient.invalidateQueries({
        queryKey: ["ticket-detail", ticketCardId],
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ["ticket-detail"] });
    }
  };
}

export function useAssignTicket(ticketCardId?: string | null) {
  const invalidate = useAssignmentInvalidation();
  return useMutation({
    mutationFn: (input: { ticketId: string; userId: string }) =>
      assignTicket(input),
    onSuccess: () => invalidate(ticketCardId),
  });
}

export function useUnassignTicket(ticketCardId?: string | null) {
  const invalidate = useAssignmentInvalidation();
  return useMutation({
    mutationFn: (input: { ticketId: string; userId: string }) =>
      unassignTicket(input),
    onSuccess: () => invalidate(ticketCardId),
  });
}
