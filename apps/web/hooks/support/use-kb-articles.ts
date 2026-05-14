"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useKBArticles(sectorId: string | undefined) {
  return useQuery({
    queryKey: ["kb-articles", sectorId],
    queryFn: async () => {
      if (!sectorId) return [];
      const supabase = createClient();
      const { data } = await supabase
        .from("kb_articles")
        .select("*")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!sectorId,
  });
}
