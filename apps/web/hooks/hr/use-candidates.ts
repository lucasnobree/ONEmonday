"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface Candidate {
  id: string;
  job_opening_id: string;
  sector_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  resume_url: string | null;
  linkedin_url: string | null;
  source: string | null;
  current_company: string | null;
  current_position: string | null;
  expected_salary: number | null;
  notes: string | null;
  card_id: string | null;
  stage: string;
  created_at: string;
}

export function useCandidates(jobOpeningId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-candidates", jobOpeningId],
    queryFn: async () => {
      if (!jobOpeningId) return [];

      const { data, error } = await supabase
        .from("hr_candidates")
        .select("*")
        .eq("job_opening_id", jobOpeningId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as Candidate[]) ?? [];
    },
    enabled: !!jobOpeningId,
  });
}
