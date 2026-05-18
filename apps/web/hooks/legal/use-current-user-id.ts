"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * The current authenticated user's id, or `null` when unauthenticated.
 * Used by the matter comment thread to decide which comments the user owns
 * (and may therefore edit / delete inline).
 */
export function useCurrentUserId() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["current-user-id"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}
