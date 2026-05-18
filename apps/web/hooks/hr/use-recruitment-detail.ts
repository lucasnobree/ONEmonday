"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { CANDIDATE_STAGES } from "@/lib/validations/hr";

export interface RecruitmentCandidate {
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
  rating: number | null;
  notes: string | null;
  stage: string;
  stage_changed_at: string;
  created_at: string;
}

export interface RecruitmentColumn {
  stage: string;
  label: string;
  candidates: RecruitmentCandidate[];
}

export interface RecruitmentBoardData {
  columns: RecruitmentColumn[];
  total: number;
}

export const STAGE_LABELS: Record<string, string> = {
  applied: "Inscritos",
  screening: "Triagem",
  interview: "Entrevista",
  offer: "Proposta",
  hired: "Contratado",
  rejected: "Reprovado",
};

/**
 * Loads the candidates for a job opening, grouped into pipeline-stage columns.
 * Backed directly by `hr_candidates` (migration 00107 added `stage`).
 */
export function useRecruitmentBoard(openingId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-recruitment-board", openingId],
    queryFn: async (): Promise<RecruitmentBoardData | null> => {
      if (!openingId) return null;

      const { data, error } = await supabase
        .from("hr_candidates")
        .select(
          "id, job_opening_id, sector_id, full_name, email, phone, resume_url, linkedin_url, source, current_company, current_position, expected_salary, rating, notes, stage, stage_changed_at, created_at"
        )
        .eq("job_opening_id", openingId)
        .eq("is_active", true)
        .order("stage_changed_at", { ascending: false });

      if (error) throw error;

      const candidates = (data as RecruitmentCandidate[]) ?? [];

      const columns: RecruitmentColumn[] = CANDIDATE_STAGES.map((stage) => ({
        stage,
        label: STAGE_LABELS[stage] ?? stage,
        candidates: candidates.filter((c) => c.stage === stage),
      }));

      return { columns, total: candidates.length };
    },
    enabled: !!openingId,
  });
}

export interface CandidateNote {
  id: string;
  candidate_id: string;
  author_id: string;
  rating: number | null;
  body: string;
  created_at: string;
}

/** Loads interview notes / scorecards for a single candidate. */
export function useCandidateNotes(candidateId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-candidate-notes", candidateId],
    queryFn: async (): Promise<CandidateNote[]> => {
      if (!candidateId) return [];

      const { data, error } = await supabase
        .from("hr_candidate_notes")
        .select("id, candidate_id, author_id, rating, body, created_at")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as CandidateNote[]) ?? [];
    },
    enabled: !!candidateId,
  });
}
