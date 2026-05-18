/**
 * Expense approval state machine.
 *
 * An expense moves through a submitter -> approver -> paid workflow:
 *
 *   pending  --submit-->  submitted
 *   submitted --approve--> approved   --pay--> paid
 *   submitted --reject-->  rejected
 *   approved --pay--> paid
 *   rejected --submit--> submitted   (resubmit after fixing)
 *
 * `pending` remains the default for quick informal entries and `void` can be
 * reached from any non-terminal state (an expense cancelled outright). The
 * server action layer enforces these transitions; this module is the single
 * source of truth for which transitions are legal.
 */

export type ExpenseStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "rejected"
  | "paid"
  | "void";

/** Workflow transitions a user can trigger. */
export type ExpenseTransition =
  | "submit"
  | "approve"
  | "reject"
  | "pay"
  | "void"
  | "reopen";

/** The status each transition lands the expense in. */
const TRANSITION_TARGET: Record<ExpenseTransition, ExpenseStatus> = {
  submit: "submitted",
  approve: "approved",
  reject: "rejected",
  pay: "paid",
  void: "void",
  reopen: "pending",
};

/** From each status, the set of transitions that are legal. */
const ALLOWED: Record<ExpenseStatus, ExpenseTransition[]> = {
  pending: ["submit", "pay", "void"],
  submitted: ["approve", "reject", "void"],
  approved: ["pay", "void"],
  rejected: ["submit", "reopen", "void"],
  paid: ["reopen"],
  void: ["reopen"],
};

/** Whether `transition` may be applied to an expense currently in `from`. */
export function canTransition(
  from: ExpenseStatus,
  transition: ExpenseTransition
): boolean {
  return (ALLOWED[from] ?? []).includes(transition);
}

/**
 * The status reached by applying `transition` to `from`, or `null` when the
 * transition is illegal from that state.
 */
export function applyTransition(
  from: ExpenseStatus,
  transition: ExpenseTransition
): ExpenseStatus | null {
  if (!canTransition(from, transition)) return null;
  return TRANSITION_TARGET[transition];
}

/** The transitions available from a given status (for rendering action menus). */
export function availableTransitions(
  from: ExpenseStatus
): ExpenseTransition[] {
  return ALLOWED[from] ?? [];
}

/**
 * Transitions that require the `expense:approve` permission. Approving and
 * rejecting are control functions; submitting / paying / voiding are not.
 */
export function transitionNeedsApprovalPermission(
  transition: ExpenseTransition
): boolean {
  return transition === "approve" || transition === "reject";
}
