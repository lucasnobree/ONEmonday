"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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

export function useSurveys(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-surveys", sectorId],
    queryFn: async (): Promise<Survey[]> => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("hr_surveys")
        .select("*, hr_survey_questions(id), hr_survey_responses(id)")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

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
    enabled: !!sectorId,
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
