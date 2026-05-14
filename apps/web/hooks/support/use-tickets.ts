"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useTickets(sectorId: string | undefined) {
  return useQuery({
    queryKey: ["support-tickets", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("support_tickets")
        .select("*, card:cards(*)")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!sectorId,
  });
}
