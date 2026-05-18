/**
 * Service-role-backed marketing-sequence runner.
 *
 * The Phase-5 server action `runDueSequenceSteps` is the manual entrypoint —
 * it runs inside a user session and is reached by the "Processar agora" button
 * on the automations page. The scheduled `app/api/cron/run-sequences` route
 * cannot use a user session, so it calls {@link runDueSequenceStepsWithClient}
 * with the service-role Supabase client instead.
 *
 * Both paths share the SAME pure decision core — `evaluateStep` from
 * `./sequence-runner` — so the automatic and manual triggers advance
 * enrollments identically. This module only supplies the DB + ESP side effects
 * against a caller-provided client, which keeps it free of `next/headers` and
 * therefore unit-testable with a mock.
 *
 * Server-only — it decrypts ESP credentials.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateStep,
  type EnrollmentState,
  type SequenceStep,
} from "./sequence-runner";
import { loadEmailCredential } from "@/lib/integrations/email-credential-loader";
import {
  resolveEmailAdapter,
  DEFAULT_EMAIL_PROVIDER,
} from "@/lib/integrations/email-registry";

/** Max due enrollments processed in one run — mirrors the server action. */
const RUNNER_BATCH_SIZE = 50;

/** A summary of one runner pass. */
export interface SequenceRunSummary {
  processed: number;
  advanced: number;
  emailsSent: number;
  skippedSteps: number;
  completed: number;
  sendFailures: number;
}

/** Outcome of a single per-recipient send inside the worker. */
type RecipientSendStatus = "sent" | "skipped" | "failed";

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
 * Sends ONE email-campaign message to a SINGLE recipient and records a single
 * `marketing_email_sends` row — the client-injected twin of the
 * `sendCampaignEmailToRecipient` server-action primitive (which is bound to a
 * user session via `createClient`). It never mutates the campaign status or
 * roll-up counters: a sequence drips a campaign once per recipient over time.
 *
 * Never throws — an unconfigured ESP yields `skipped`, an ESP error `failed`.
 */
async function sendCampaignEmailWithClient(
  client: SupabaseClient,
  emailCampaignId: string,
  recipient: { email: string; name?: string }
): Promise<RecipientSendStatus> {
  const { data: campaign } = await client
    .from("marketing_email_campaigns")
    .select(
      "id, sector_id, subject, from_name, from_email, reply_to, body_html, body_text"
    )
    .eq("id", emailCampaignId)
    .eq("is_active", true)
    .single();
  if (!campaign) return "failed";

  const credential = await loadEmailCredential(client, campaign.sector_id);
  const provider = credential.provider ?? DEFAULT_EMAIL_PROVIDER;
  const adapter = resolveEmailAdapter(provider, credential.config);

  const sendResult = await adapter.send({
    to: recipient.email,
    toName: recipient.name,
    from: campaign.from_email,
    fromName: campaign.from_name,
    replyTo: campaign.reply_to ?? undefined,
    subject: campaign.subject,
    html: campaign.body_html,
    text: campaign.body_text || undefined,
    // Deterministic idempotency key — a redelivery never double-sends at the
    // ESP. Scoped per (campaign, recipient): a sequence sends each campaign to
    // a given recipient exactly once.
    idempotencyKey: `seq-${campaign.id}-${recipient.email}`,
  });

  let status: RecipientSendStatus;
  if (sendResult.noop) {
    status = "skipped";
  } else if (sendResult.ok) {
    status = "sent";
  } else {
    status = "failed";
  }

  const { error: sendErr } = await client
    .from("marketing_email_sends")
    .insert({
      sector_id: campaign.sector_id,
      email_campaign_id: campaign.id,
      recipient_email: recipient.email,
      recipient_name: recipient.name ?? null,
      status,
      provider_ref: sendResult.providerRef ?? null,
      error: sendResult.noop
        ? "Gateway de e-mail nao configurado — nada foi enviado"
        : (sendResult.error ?? null),
      sent_at:
        sendResult.ok && !sendResult.noop ? new Date().toISOString() : null,
    });
  if (sendErr) return "failed";

  return status;
}

/**
 * Drains active enrollments whose `next_run_at` is due, evaluates each with the
 * pure `evaluateStep` logic, performs the step side effect, and persists the
 * advanced enrollment state — using the supplied Supabase client (the scheduled
 * route passes a service-role client, which bypasses RLS so the worker
 * processes every sector).
 *
 * A failed `send_email` leaves the enrollment in place so the next pass
 * retries it. Never throws: a query error is returned as `{ error }`.
 */
export async function runDueSequenceStepsWithClient(
  client: SupabaseClient
): Promise<{ error: string } | SequenceRunSummary> {
  const nowIso = new Date().toISOString();

  const { data: due, error } = await client
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
      const { data: seq } = await client
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
      const { data: stepRows } = await client
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
      const status = await sendCampaignEmailWithClient(
        client,
        evaluation.action.emailCampaignId,
        {
          email: enrollment.recipient_email,
          name: enrollment.recipient_name ?? undefined,
        }
      );
      if (status === "failed") {
        // The send failed — do NOT advance the enrollment. Leaving it in place
        // (same step, same next_run_at) means the next pass retries it.
        sendFailures += 1;
        continue;
      }
      if (status === "sent") emailsSent += 1;
    } else if (evaluation.action.kind === "skip") {
      skippedSteps += 1;
    }

    // Persist the advanced enrollment state.
    await client
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

  return {
    processed: enrollments.length,
    advanced,
    emailsSent,
    skippedSteps,
    completed,
    sendFailures,
  };
}

export { RUNNER_BATCH_SIZE };
