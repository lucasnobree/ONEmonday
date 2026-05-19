"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isScopeReady,
  sectorFilterValue,
} from "@/lib/navigation/scoped-query";
import type { SectorScope } from "@/lib/navigation/sector-scope";
import {
  createSequence,
  updateSequence,
  deleteSequence,
  saveSequenceSteps,
  enrollInSequence,
  runDueSequenceSteps,
} from "@/lib/actions/marketing/sequences";
import type {
  SequenceTrigger,
  SequenceStatus,
  SequenceStepType,
} from "@/lib/validations/marketing";

export interface Sequence {
  id: string;
  sector_id: string;
  name: string;
  description: string | null;
  trigger_type: SequenceTrigger;
  segment_id: string | null;
  status: SequenceStatus;
  created_at: string;
}

export interface SequenceStepRow {
  id: string;
  sequence_id: string;
  step_order: number;
  step_type: SequenceStepType;
  wait_days: number;
  email_campaign_id: string | null;
}

export interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  recipient_email: string;
  recipient_name: string | null;
  current_step: number;
  status: "active" | "completed" | "cancelled";
  next_run_at: string;
}

export function useSequences(scope: SectorScope | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["marketing-sequences", scope],
    queryFn: async () => {
      if (!isScopeReady(scope)) return [];

      let query = supabase
        .from("marketing_sequences")
        .select(
          `id, sector_id, name, description, trigger_type, segment_id,
           status, created_at`
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      const filterSectorId = sectorFilterValue(scope);
      if (filterSectorId) query = query.eq("sector_id", filterSectorId);

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []) as Sequence[];
    },
    enabled: isScopeReady(scope),
  });
}

export function useSequenceSteps(sequenceId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["marketing-sequence-steps", sequenceId],
    queryFn: async () => {
      if (!sequenceId) return [];

      const { data, error } = await supabase
        .from("marketing_sequence_steps")
        .select(
          `id, sequence_id, step_order, step_type, wait_days, email_campaign_id`
        )
        .eq("sequence_id", sequenceId)
        .order("step_order", { ascending: true });

      if (error) throw error;
      return (data ?? []) as SequenceStepRow[];
    },
    enabled: !!sequenceId,
  });
}

export function useSequenceEnrollments(sequenceId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["marketing-sequence-enrollments", sequenceId],
    queryFn: async () => {
      if (!sequenceId) return [];

      const { data, error } = await supabase
        .from("marketing_sequence_enrollments")
        .select(
          `id, sequence_id, recipient_email, recipient_name, current_step,
           status, next_run_at`
        )
        .eq("sequence_id", sequenceId)
        .order("enrolled_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as SequenceEnrollment[];
    },
    enabled: !!sequenceId,
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["marketing-sequences"] });
  queryClient.invalidateQueries({ queryKey: ["marketing-sequence-steps"] });
  queryClient.invalidateQueries({
    queryKey: ["marketing-sequence-enrollments"],
  });
}

export function useCreateSequence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => createSequence(input),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useUpdateSequence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => updateSequence(input),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteSequence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSequence(id),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useSaveSequenceSteps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => saveSequenceSteps(input),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useEnrollInSequence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => enrollInSequence(input),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useRunSequenceSteps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => runDueSequenceSteps(),
    onSuccess: () => invalidate(queryClient),
  });
}
