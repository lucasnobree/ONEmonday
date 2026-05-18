"use server";

/**
 * Automation-sequence server actions — Phase 5 marketing automation.
 *
 * A sequence is a `trigger -> [step, ...]` model. These actions let a user
 * define a sequence and its ordered steps, enroll recipients, and run the
 * runner.
 *
 * The runner — `runDueSequenceSteps` — is a server-action ENTRYPOINT, exactly
 * like Phase 1's `runOutboxDispatch`: a scheduled worker is out of scope, but
 * the entrypoint is ready (an admin "processar agora" button or a future cron
 * both call it). It drains active enrollments whose `next_run_at` is due,
 * evaluates each with the pure `sequence-runner` logic, performs the step's
 * side effect (a `send_email` step calls the per-recipient
 * `sendCampaignEmailToRecipient` primitive — NOT the campaign-blast
 * `sendEmailCampaign`, which would lock the campaign to `sent` and let only the
 * first enrollment through), and persists the advanced enrollment state. A
 * failed send leaves the enrollment in place so the next run retries it.
 *
 * Honest scope: linear step list, single `segment_entry` trigger — NOT a visual
 * flow canvas or lead-scoring engine (deferred — migration-comercial.md §5).
 */
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createSequenceSchema,
  updateSequenceSchema,
  saveSequenceStepsSchema,
  enrollInSequenceSchema,
} from "@/lib/validations/marketing";
import {
  evaluateStep,
  type EnrollmentState,
  type SequenceStep,
} from "@/lib/marketing/sequence-runner";
import { sendCampaignEmailToRecipient } from "@/lib/actions/marketing/email-campaigns";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const RUNNER_BATCH_SIZE = 50;

export async function createSequence(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = createSequenceSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "automation", "create")) {
    return { error: "Sem permissao" };
  }

  const { data, error } = await supabase
    .from("marketing_sequences")
    .insert({
      sector_id: parsed.data.sectorId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      trigger_type: parsed.data.triggerType,
      segment_id: parsed.data.segmentId || null,
      status: parsed.data.status,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/marketing/automations");
  return { data };
}

export async function updateSequence(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = updateSequenceSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: existing } = await supabase
    .from("marketing_sequences")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Sequência não encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "automation", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("marketing_sequences")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      trigger_type: parsed.data.triggerType,
      segment_id: parsed.data.segmentId || null,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/marketing/automations");
  return { success: true };
}

export async function deleteSequence(sequenceId: string) {
  const parsed = z.string().uuid().safeParse(sequenceId);
  if (!parsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: sequence } = await supabase
    .from("marketing_sequences")
    .select("sector_id")
    .eq("id", sequenceId)
    .single();
  if (!sequence) return { error: "Sequência não encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, sequence.sector_id, "automation", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("marketing_sequences")
    .update({ is_active: false })
    .eq("id", sequenceId);

  if (error) return { error: error.message };

  revalidatePath("/marketing/automations");
  return { success: true };
}

/**
 * Replaces the full ordered step list of a sequence. Steps are validated
 * (a `send_email` step needs a campaign, a `wait` step needs >=1 day) and
 * re-inserted in one transaction-like sweep — a delete then insert, since the
 * step list is small and fully owned by one editor screen.
 */
export async function saveSequenceSteps(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = saveSequenceStepsSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: sequence } = await supabase
    .from("marketing_sequences")
    .select("sector_id")
    .eq("id", parsed.data.sequenceId)
    .single();
  if (!sequence) return { error: "Sequência não encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, sequence.sector_id, "automation", "update")) {
    return { error: "Sem permissao" };
  }

  // Step orders must be the contiguous 0..n-1 range so the runner never hits
  // a gap it has to skip.
  const orders = parsed.data.steps
    .map((s) => s.stepOrder)
    .sort((a, b) => a - b);
  const contiguous = orders.every((o, i) => o === i);
  if (!contiguous) {
    return { error: "Os passos devem estar numerados de 0 em diante" };
  }

  const { error: delErr } = await supabase
    .from("marketing_sequence_steps")
    .delete()
    .eq("sequence_id", parsed.data.sequenceId);
  if (delErr) return { error: delErr.message };

  if (parsed.data.steps.length > 0) {
    const { error: insErr } = await supabase
      .from("marketing_sequence_steps")
      .insert(
        parsed.data.steps.map((s) => ({
          sequence_id: parsed.data.sequenceId,
          step_order: s.stepOrder,
          step_type: s.stepType,
          wait_days: s.waitDays,
          email_campaign_id: s.emailCampaignId || null,
        }))
      );
    if (insErr) return { error: insErr.message };
  }

  revalidatePath("/marketing/automations");
  return { success: true };
}

/**
 * Enrolls a recipient into a sequence. Idempotent on (sequence, email): a
 * re-enroll is a no-op rather than an error. The new enrollment starts at
 * step 0 and is immediately due.
 */
export async function enrollInSequence(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = enrollInSequenceSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: sequence } = await supabase
    .from("marketing_sequences")
    .select("sector_id, status")
    .eq("id", parsed.data.sequenceId)
    .eq("is_active", true)
    .single();
  if (!sequence) return { error: "Sequência não encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, sequence.sector_id, "automation", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("marketing_sequence_enrollments")
    .upsert(
      {
        sector_id: sequence.sector_id,
        sequence_id: parsed.data.sequenceId,
        recipient_email: parsed.data.recipientEmail,
        recipient_name: parsed.data.recipientName ?? null,
        current_step: 0,
        status: "active",
        next_run_at: new Date().toISOString(),
      },
      { onConflict: "sequence_id,recipient_email", ignoreDuplicates: true }
    );

  if (error) return { error: error.message };

  revalidatePath("/marketing/automations");
  return { success: true };
}

/** Raw step row shape from `marketing_sequence_steps`. */
interface StepRow {
  step_order: number;
  step_type: "wait" | "send_email";
  wait_days: number;
  email_campaign_id: string | null;
}

/** Raw enrollment row shape from `marketing_sequence_enrollments`. */
interface EnrollmentRow {
  id: string;
  sequence_id: string;
  recipient_email: string;
  recipient_name: string | null;
  current_step: number;
  status: "active" | "completed" | "cancelled";
  next_run_at: string;
}

/**
 * The runner entrypoint. Drains active enrollments whose `next_run_at` is due,
 * evaluates the current step with the pure `evaluateStep` logic, performs the
 * step side effect, and persists the advanced enrollment state.
 *
 * Requires global-admin — like `runOutboxDispatch`, it is a worker entrypoint
 * that processes rows across every sector. A scheduled worker is out of scope;
 * this entrypoint is ready for one (or an admin "processar agora" button).
 *
 * Only processes enrollments of sequences whose status is `active`.
 */
export async function runDueSequenceSteps() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const perms = await getUserPermissions(user.id);
  if (!perms.isGlobalAdmin) return { error: "Sem permissao" };

  const nowIso = new Date().toISOString();

  const { data: due, error } = await supabase
    .from("marketing_sequence_enrollments")
    .select(
      "id, sequence_id, recipient_email, recipient_name, current_step, status, next_run_at"
    )
    .eq("status", "active")
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(RUNNER_BATCH_SIZE);
  if (error) return { error: error.message };

  const enrollments = (due ?? []) as EnrollmentRow[];

  // Cache step lists + active-status per sequence to avoid N+1 queries.
  const stepCache = new Map<string, SequenceStep[]>();
  const activeCache = new Map<string, boolean>();

  let advanced = 0;
  let emailsSent = 0;
  let skippedSteps = 0;
  let completed = 0;
  let sendFailures = 0;

  for (const enrollment of enrollments) {
    // Resolve whether the parent sequence is active (only active runs proceed).
    let sequenceActive = activeCache.get(enrollment.sequence_id);
    if (sequenceActive === undefined) {
      const { data: seq } = await supabase
        .from("marketing_sequences")
        .select("status, is_active")
        .eq("id", enrollment.sequence_id)
        .single();
      sequenceActive =
        !!seq && seq.is_active === true && seq.status === "active";
      activeCache.set(enrollment.sequence_id, sequenceActive);
    }
    if (!sequenceActive) continue;

    // Resolve the sequence step list (cached).
    let steps = stepCache.get(enrollment.sequence_id);
    if (!steps) {
      const { data: stepRows } = await supabase
        .from("marketing_sequence_steps")
        .select("step_order, step_type, wait_days, email_campaign_id")
        .eq("sequence_id", enrollment.sequence_id)
        .order("step_order", { ascending: true });
      steps = ((stepRows ?? []) as StepRow[]).map((s) => ({
        stepOrder: s.step_order,
        stepType: s.step_type,
        waitDays: s.wait_days,
        emailCampaignId: s.email_campaign_id,
      }));
      stepCache.set(enrollment.sequence_id, steps);
    }

    const state: EnrollmentState = {
      currentStep: enrollment.current_step,
      status: enrollment.status,
      nextRunAt: enrollment.next_run_at,
    };

    const evaluation = evaluateStep(state, steps, nowIso);

    // Perform the step side effect.
    if (evaluation.action.kind === "send_email") {
      const result = await sendCampaignEmailToRecipient({
        emailCampaignId: evaluation.action.emailCampaignId,
        recipient: {
          email: enrollment.recipient_email,
          name: enrollment.recipient_name ?? undefined,
        },
      });
      if (result.status === "failed") {
        // The send failed — do NOT advance the enrollment. Leaving it in place
        // (same step, same next_run_at) means the next runner pass retries it,
        // instead of silently skipping the recipient's email.
        sendFailures += 1;
        continue;
      }
      if (result.status === "sent") emailsSent += 1;
    } else if (evaluation.action.kind === "skip") {
      skippedSteps += 1;
    }

    // Persist the advanced enrollment state.
    await supabase
      .from("marketing_sequence_enrollments")
      .update({
        current_step: evaluation.nextState.currentStep,
        status: evaluation.nextState.status,
        next_run_at: evaluation.nextState.nextRunAt,
        completed_at:
          evaluation.nextState.status === "completed"
            ? new Date().toISOString()
            : null,
      })
      .eq("id", enrollment.id);

    advanced += 1;
    if (evaluation.nextState.status === "completed") completed += 1;
  }

  revalidatePath("/marketing/automations");
  return {
    success: true,
    processed: enrollments.length,
    advanced,
    emailsSent,
    skippedSteps,
    completed,
    sendFailures,
  };
}
