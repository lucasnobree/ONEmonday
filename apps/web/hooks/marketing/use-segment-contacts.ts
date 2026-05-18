"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { saveSegmentContacts } from "@/lib/actions/marketing/segment-contacts";

/** A single contact belonging to an audience segment. */
export interface SegmentContact {
  id: string;
  segment_id: string;
  email: string;
  name: string | null;
}

/**
 * Loads the contacts of an audience segment. Disabled until a `segmentId` is
 * supplied (a not-yet-created segment has no contacts).
 */
export function useSegmentContacts(segmentId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["marketing-segment-contacts", segmentId],
    queryFn: async () => {
      if (!segmentId) return [];

      const { data, error } = await supabase
        .from("marketing_segment_contacts")
        .select("id, segment_id, email, name")
        .eq("segment_id", segmentId)
        .order("email", { ascending: true });

      if (error) throw error;
      return (data ?? []) as SegmentContact[];
    },
    enabled: !!segmentId,
  });
}

/** Replaces a segment's full contact list. */
export function useSaveSegmentContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => saveSegmentContacts(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["marketing-segment-contacts"],
      });
    },
  });
}
