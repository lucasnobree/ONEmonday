// Pure helpers for the HR recruitment pipeline. Framework-free so they can be
// unit-tested directly and shared between server actions and components.

import { CANDIDATE_STAGES } from "@/lib/validations/hr";

export type CandidateStage = (typeof CANDIDATE_STAGES)[number];

/** Stages that represent an active candidate still moving through the funnel. */
const ACTIVE_STAGES: CandidateStage[] = [
  "applied",
  "screening",
  "interview",
  "offer",
];

/** True when the stage is a terminal outcome (hired or rejected). */
export function isTerminalStage(stage: string): boolean {
  return stage === "hired" || stage === "rejected";
}

/**
 * Zero-based index of a stage in the canonical pipeline order. Returns -1 for
 * an unknown stage.
 */
export function stageOrder(stage: string): number {
  return (CANDIDATE_STAGES as readonly string[]).indexOf(stage);
}

/**
 * True when moving `from` → `to` is a forward progression through the funnel.
 * Moving into a terminal stage (hired/rejected) is always allowed; moving
 * backwards or to the same stage is not a "progression".
 */
export function isForwardMove(from: string, to: string): boolean {
  if (stageOrder(from) < 0 || stageOrder(to) < 0) return false;
  if (from === to) return false;
  if (isTerminalStage(to)) return true;
  return stageOrder(to) > stageOrder(from);
}

/** Canonical lifecycle statuses for a job opening (vaga). */
export const JOB_OPENING_STATUSES = [
  "open",
  "closed",
  "filled",
  "cancelled",
] as const;

export type JobOpeningStatus = (typeof JOB_OPENING_STATUSES)[number];

/** True when the given value is a known job-opening status. */
export function isJobOpeningStatus(value: string): value is JobOpeningStatus {
  return (JOB_OPENING_STATUSES as readonly string[]).includes(value);
}

/**
 * The set of statuses a vaga in `current` may legitimately move to. An open
 * vaga can be closed, filled or cancelled; a non-open vaga can only be
 * reopened. Re-selecting the current status is never a valid transition.
 */
export function allowedStatusTransitions(current: string): JobOpeningStatus[] {
  if (current === "open") return ["closed", "filled", "cancelled"];
  if (isJobOpeningStatus(current)) return ["open"];
  return [];
}

/** True when moving a vaga `from` → `to` is an allowed status transition. */
export function canTransitionStatus(from: string, to: string): boolean {
  return (allowedStatusTransitions(from) as string[]).includes(to);
}

/**
 * Summarises a set of candidate stages into pipeline counts: how many are
 * still active, hired and rejected.
 */
export function pipelineSummary(stages: string[]): {
  active: number;
  hired: number;
  rejected: number;
  total: number;
} {
  let active = 0;
  let hired = 0;
  let rejected = 0;

  for (const stage of stages) {
    if (stage === "hired") hired += 1;
    else if (stage === "rejected") rejected += 1;
    else if ((ACTIVE_STAGES as string[]).includes(stage)) active += 1;
  }

  return { active, hired, rejected, total: stages.length };
}
