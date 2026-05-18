/**
 * Pure automation-sequence step logic — Phase 5 marketing automation.
 *
 * A sequence is a `trigger -> [step, step, ...]` model. A recipient is enrolled
 * and the runner advances them one step at a time:
 *
 *   * a `wait` step delays the enrollment by `wait_days` days;
 *   * a `send_email` step sends the linked email campaign to the recipient.
 *
 * This module is the decision core: given an enrollment's current position and
 * the sequence's steps, it computes the next action and the next enrollment
 * state. It is pure (no DB, no clock except an injected `now`) so it is fully
 * unit-testable. The server-action runner in
 * `lib/actions/marketing/sequences.ts` supplies the DB + ESP side effects.
 *
 * Honest scope: this is a linear step list, NOT a visual flow canvas with
 * branches / conditions (explicitly deferred — see migration-comercial.md §5).
 */

/** A sequence step as the runner sees it. */
export interface SequenceStep {
  stepOrder: number;
  stepType: "wait" | "send_email";
  /** Delay in days for a `wait` step. */
  waitDays: number;
  /** Email campaign id for a `send_email` step, when set. */
  emailCampaignId: string | null;
}

/** An enrollment's mutable position in a sequence. */
export interface EnrollmentState {
  /** 0-based index of the next step to process. */
  currentStep: number;
  status: "active" | "completed" | "cancelled";
  /** Earliest ISO timestamp the next step may run. */
  nextRunAt: string;
}

/** The action the runner must perform for one processed step. */
export type StepAction =
  | { kind: "wait"; untilIso: string }
  | { kind: "send_email"; emailCampaignId: string }
  | { kind: "skip"; reason: string }
  | { kind: "complete" };

/** The outcome of evaluating one step against an enrollment. */
export interface StepEvaluation {
  /** What the caller must do (a side effect, or nothing). */
  action: StepAction;
  /** The enrollment state to persist after this evaluation. */
  nextState: EnrollmentState;
}

/** Adds `days` whole days to an ISO timestamp, returning a new ISO string. */
export function addDays(fromIso: string, days: number): string {
  const d = new Date(fromIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/**
 * True when an active enrollment is due to be processed at `nowIso` — i.e. its
 * `nextRunAt` is at or before now. Used to filter the runner's work queue.
 */
export function isEnrollmentDue(
  state: Pick<EnrollmentState, "status" | "nextRunAt">,
  nowIso: string
): boolean {
  return (
    state.status === "active" &&
    new Date(state.nextRunAt).getTime() <= new Date(nowIso).getTime()
  );
}

/** Finds the step at `order` within a (possibly unsorted) step list. */
export function stepAt(
  steps: SequenceStep[],
  order: number
): SequenceStep | undefined {
  return steps.find((s) => s.stepOrder === order);
}

/**
 * Evaluates the step an enrollment is currently positioned on and returns the
 * action to take plus the next enrollment state. It does NOT perform side
 * effects — the caller sends the email / persists the state.
 *
 * Behaviour per step:
 *   * past the last step          -> `complete`, status becomes `completed`.
 *   * `wait`  step                -> `wait` until now + waitDays; advance the
 *                                    pointer so the next run lands on the
 *                                    following step.
 *   * `send_email` with a campaign-> `send_email`; advance the pointer; the
 *                                    next step (if any) becomes immediately
 *                                    due.
 *   * `send_email` with no linked campaign -> `skip`; advance the pointer so a
 *                                    misconfigured step never stalls a run.
 *
 * `steps` need not be pre-sorted — the step at `currentStep` is looked up by
 * `stepOrder`.
 */
export function evaluateStep(
  state: EnrollmentState,
  steps: SequenceStep[],
  nowIso: string
): StepEvaluation {
  // The number of steps is the count of distinct, defined step orders.
  const maxOrder = steps.reduce((m, s) => Math.max(m, s.stepOrder), -1);

  // Past the final step — the enrollment is done.
  if (state.currentStep > maxOrder) {
    return {
      action: { kind: "complete" },
      nextState: {
        currentStep: state.currentStep,
        status: "completed",
        nextRunAt: state.nextRunAt,
      },
    };
  }

  const step = stepAt(steps, state.currentStep);

  // A gap in the step list — treat as a no-op skip and advance past it.
  if (!step) {
    const advanced = advance(state, nowIso, maxOrder);
    return {
      action: { kind: "skip", reason: `Passo ${state.currentStep} ausente` },
      nextState: advanced,
    };
  }

  if (step.stepType === "wait") {
    const days = Math.max(0, step.waitDays);
    const advanced = advance(state, addDays(nowIso, days), maxOrder);
    return {
      action: { kind: "wait", untilIso: addDays(nowIso, days) },
      nextState: advanced,
    };
  }

  // step.stepType === "send_email"
  if (!step.emailCampaignId) {
    const advanced = advance(state, nowIso, maxOrder);
    return {
      action: {
        kind: "skip",
        reason: "Passo de e-mail sem campanha vinculada",
      },
      nextState: advanced,
    };
  }

  const advanced = advance(state, nowIso, maxOrder);
  return {
    action: { kind: "send_email", emailCampaignId: step.emailCampaignId },
    nextState: advanced,
  };
}

/**
 * Advances the enrollment pointer by one step. When the new pointer is past the
 * last step the enrollment is marked `completed`. `nextRunAtIso` is when the
 * (now next) step becomes due.
 */
function advance(
  state: EnrollmentState,
  nextRunAtIso: string,
  maxOrder: number
): EnrollmentState {
  const nextStep = state.currentStep + 1;
  const done = nextStep > maxOrder;
  return {
    currentStep: nextStep,
    status: done ? "completed" : "active",
    nextRunAt: nextRunAtIso,
  };
}
