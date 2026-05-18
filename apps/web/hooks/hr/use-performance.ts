"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface ReviewCycle {
  id: string;
  sector_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  evaluation_count: number;
}

export function useReviewCycles(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-review-cycles", sectorId],
    queryFn: async (): Promise<ReviewCycle[]> => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("hr_review_cycles")
        .select("*, hr_evaluations(id)")
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (
        data?.map((cycle) => ({
          ...cycle,
          evaluation_count: Array.isArray(cycle.hr_evaluations)
            ? cycle.hr_evaluations.length
            : 0,
          hr_evaluations: undefined,
        })) ?? []
      ) as ReviewCycle[];
    },
    enabled: !!sectorId,
  });
}

export interface Evaluation {
  id: string;
  cycle_id: string;
  sector_id: string;
  employee_id: string;
  reviewer_id: string | null;
  status: string;
  performance_score: number | null;
  potential_score: number | null;
  overall_rating: number | null;
  strengths: string | null;
  improvements: string | null;
  comments: string | null;
  submitted_at: string | null;
  employee_name: string;
  employee_position: string | null;
}

export function useEvaluations(cycleId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-evaluations", cycleId],
    queryFn: async (): Promise<Evaluation[]> => {
      if (!cycleId) return [];

      const { data, error } = await supabase
        .from("hr_evaluations")
        .select("*, hr_employees!hr_evaluations_employee_id_fkey(full_name, position)")
        .eq("cycle_id", cycleId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (
        data?.map((ev) => {
          const emp = ev.hr_employees as
            | { full_name: string; position: string | null }
            | { full_name: string; position: string | null }[]
            | null;
          const e = Array.isArray(emp) ? emp[0] : emp;
          return {
            ...ev,
            employee_name: e?.full_name ?? "—",
            employee_position: e?.position ?? null,
            hr_employees: undefined,
          };
        }) ?? []
      ) as Evaluation[];
    },
    enabled: !!cycleId,
  });
}

export interface NineBoxEntry {
  evaluation_id: string;
  employee_id: string;
  employee_name: string;
  employee_position: string | null;
  performance_score: number;
  potential_score: number;
  overall_rating: number | null;
}

export function useNineBoxGrid(cycleId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-nine-box", cycleId],
    queryFn: async (): Promise<NineBoxEntry[]> => {
      if (!cycleId) return [];

      const { data, error } = await supabase.rpc("get_nine_box_grid", {
        p_cycle_id: cycleId,
      });

      if (error) throw error;
      return (data as NineBoxEntry[]) ?? [];
    },
    enabled: !!cycleId,
  });
}

export interface SelfAssessment {
  id: string;
  cycle_id: string;
  sector_id: string;
  employee_id: string;
  status: string;
  performance_score: number | null;
  potential_score: number | null;
  overall_rating: number | null;
  achievements: string | null;
  challenges: string | null;
  goals: string | null;
  submitted_at: string | null;
}

export interface SelfAssessmentContext {
  found: boolean;
  cycle?: {
    id: string;
    name: string;
    status: string;
    start_date: string;
    end_date: string;
  };
  employee_id?: string;
  employee_name?: string;
  assessment?: SelfAssessment | null;
}

/**
 * Loads the self-assessment context for the calling employee in a cycle: the
 * cycle, the employee row, and their existing self-assessment (if any). Backed
 * by the `get_self_assessment_context` RPC.
 */
export function useSelfAssessmentContext(cycleId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-self-assessment", cycleId],
    queryFn: async (): Promise<SelfAssessmentContext> => {
      if (!cycleId) return { found: false };

      const { data, error } = await supabase.rpc(
        "get_self_assessment_context",
        { p_cycle_id: cycleId }
      );

      if (error) throw error;
      return (data as SelfAssessmentContext) ?? { found: false };
    },
    enabled: !!cycleId,
  });
}

/** Loads a single employee's self-assessment for a cycle (manager read). */
export function useEvaluationSelfAssessment(
  cycleId: string | null,
  employeeId: string | null
) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-self-assessment-for-eval", cycleId, employeeId],
    queryFn: async (): Promise<SelfAssessment | null> => {
      if (!cycleId || !employeeId) return null;

      const { data, error } = await supabase
        .from("hr_self_assessments")
        .select("*")
        .eq("cycle_id", cycleId)
        .eq("employee_id", employeeId)
        .maybeSingle();

      if (error) throw error;
      return (data as SelfAssessment | null) ?? null;
    },
    enabled: !!cycleId && !!employeeId,
  });
}

export interface DevelopmentAction {
  id: string;
  plan_id: string;
  title: string;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  position: number;
}

export interface DevelopmentPlan {
  id: string;
  sector_id: string;
  employee_id: string;
  evaluation_id: string | null;
  title: string;
  objective: string | null;
  status: string;
  target_date: string | null;
  created_at: string;
  employee_name: string;
  actions: DevelopmentAction[];
}

export function useDevelopmentPlans(sectorId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["hr-development-plans", sectorId],
    queryFn: async (): Promise<DevelopmentPlan[]> => {
      if (!sectorId) return [];

      const { data, error } = await supabase
        .from("hr_development_plans")
        .select(
          "*, hr_employees!hr_development_plans_employee_id_fkey(full_name), hr_development_actions(*)"
        )
        .eq("sector_id", sectorId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (
        data?.map((plan) => {
          const emp = plan.hr_employees as
            | { full_name: string }
            | { full_name: string }[]
            | null;
          const e = Array.isArray(emp) ? emp[0] : emp;
          const actions = ((plan.hr_development_actions ?? []) as DevelopmentAction[])
            .slice()
            .sort((a, b) => a.position - b.position);
          return {
            ...plan,
            employee_name: e?.full_name ?? "—",
            actions,
            hr_employees: undefined,
            hr_development_actions: undefined,
          };
        }) ?? []
      ) as DevelopmentPlan[];
    },
    enabled: !!sectorId,
  });
}
