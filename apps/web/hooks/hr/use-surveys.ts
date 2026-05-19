"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  prompt: string;
  question_type: string;
  position: number;
}

export interface Survey {
  id: string;
  sector_id: string;
  title: string;
  description: string | null;
  status: string;
  survey_type: string;
  created_at: string;
  question_count: number;
  response_count: number;
}

export function useSurveys(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-surveys", scope],
    queryFn: async (): Promise<Survey[]> => {
      if (!isScopeReady(scope)) return [];

      let query = supabase
        .from("hr_surveys")
        .select("*, hr_survey_questions(id), hr_survey_responses(id)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query;

      if (error) throw error;

      return (
        data?.map((s) => ({
          ...s,
          question_count: Array.isArray(s.hr_survey_questions)
            ? s.hr_survey_questions.length
            : 0,
          response_count: Array.isArray(s.hr_survey_responses)
            ? s.hr_survey_responses.length
            : 0,
          hr_survey_questions: undefined,
          hr_survey_responses: undefined,
        })) ?? []
      ) as Survey[];
    },
    enabled: isScopeReady(scope),
  });
}

export function useSurveyQuestions(surveyId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-survey-questions", surveyId],
    queryFn: async (): Promise<SurveyQuestion[]> => {
      if (!surveyId) return [];

      const { data, error } = await supabase
        .from("hr_survey_questions")
        .select("*")
        .eq("survey_id", surveyId)
        .order("position", { ascending: true });

      if (error) throw error;
      return (data as SurveyQuestion[]) ?? [];
    },
    enabled: !!surveyId,
  });
}

export interface SurveyQuestionResult {
  id: string;
  prompt: string;
  question_type: string;
  position: number;
  answer_count: number;
  average_score: number | null;
}

export interface SurveyResults {
  response_count: number;
  enps: number | null;
  questions: SurveyQuestionResult[];
}

export function useSurveyResults(surveyId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-survey-results", surveyId],
    queryFn: async (): Promise<SurveyResults | null> => {
      if (!surveyId) return null;

      const { data, error } = await supabase.rpc("get_survey_results", {
        p_survey_id: surveyId,
      });

      if (error) throw error;
      return data as SurveyResults;
    },
    enabled: !!surveyId,
  });
}

export interface SurveyForRespondent {
  survey: {
    id: string;
    title: string;
    description: string | null;
    status: string;
  };
  questions: SurveyQuestion[];
}

/**
 * Loads a single survey plus its questions for the employee answering page.
 * Distinct from `useSurveys` (admin list, sector-scoped + counts).
 */
export function useSurveyForRespondent(surveyId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-survey-respondent", surveyId],
    queryFn: async (): Promise<SurveyForRespondent | null> => {
      if (!surveyId) return null;

      const { data: survey, error } = await supabase
        .from("hr_surveys")
        .select("id, title, description, status")
        .eq("id", surveyId)
        .single();
      if (error) throw error;

      const { data: questions, error: qError } = await supabase
        .from("hr_survey_questions")
        .select("*")
        .eq("survey_id", surveyId)
        .order("position", { ascending: true });
      if (qError) throw qError;

      return {
        survey,
        questions: (questions as SurveyQuestion[]) ?? [],
      };
    },
    enabled: !!surveyId,
  });
}

export interface SurveyEmployeeContext {
  found: boolean;
  employee_id?: string;
  employee_name?: string;
  already_responded?: boolean;
}

/**
 * Resolves the calling user's hr_employee row for a survey, and whether they
 * have already responded. Backed by the `get_survey_employee` RPC so the
 * employee directory is not exposed to every authenticated user.
 */
export function useSurveyEmployee(surveyId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-survey-employee", surveyId],
    queryFn: async (): Promise<SurveyEmployeeContext> => {
      if (!surveyId) return { found: false };

      const { data, error } = await supabase.rpc("get_survey_employee", {
        p_survey_id: surveyId,
      });

      if (error) throw error;
      return (data as SurveyEmployeeContext) ?? { found: false };
    },
    enabled: !!surveyId,
  });
}

export interface SurveyParticipation {
  eligible: number;
  responded: number;
}

/**
 * Loads the participation rate (responded / eligible) for a survey. Returns
 * counts only — never individual identities.
 */
export function useSurveyParticipation(surveyId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-survey-participation", surveyId],
    queryFn: async (): Promise<SurveyParticipation> => {
      if (!surveyId) return { eligible: 0, responded: 0 };

      const { data, error } = await supabase.rpc("get_survey_participation", {
        p_survey_id: surveyId,
      });

      if (error) throw error;
      return (data as SurveyParticipation) ?? { eligible: 0, responded: 0 };
    },
    enabled: !!surveyId,
  });
}
