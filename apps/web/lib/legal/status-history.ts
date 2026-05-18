/**
 * Legal status-change history + the lightweight contract approval step.
 *
 * Contracts already carry a `draft -> in_review -> approved -> active ...`
 * status enum (migration 00080). The Wave 4 audit (C1/K2) flagged that those
 * statuses imply a workflow that does not exist: a status was advanced only by
 * re-picking a dropdown, with no record of who moved it.
 *
 * This module is the single source of truth for the lightweight approval
 * actions, modelled as ordinary transitions over the existing statuses:
 *
 *   draft     --submit_for_approval--> in_review
 *   in_review --approve-->             approved
 *   in_review --reject-->              draft
 *
 * The server-action layer enforces these and writes a `legal_status_history`
 * row for every transition (including a free-pick status change from the edit
 * dialog). Nothing here touches the database — it is pure logic, unit-tested.
 */

import { CONTRACT_STATUS_LABELS } from "./labels";

/** A contract-approval action a user can trigger from the detail sheet. */
export type ContractApprovalAction =
  | "submit_for_approval"
  | "approve"
  | "reject";

/** The status each approval action lands a contract in. */
const APPROVAL_TARGET: Record<ContractApprovalAction, string> = {
  submit_for_approval: "in_review",
  approve: "approved",
  reject: "draft",
};

/** From each status, the approval actions that are legal. */
const APPROVAL_ALLOWED: Record<string, ContractApprovalAction[]> = {
  draft: ["submit_for_approval"],
  in_review: ["approve", "reject"],
};

/** pt-BR labels for the approval actions (buttons / toasts). */
export const CONTRACT_APPROVAL_LABELS: Record<ContractApprovalAction, string> =
  {
    submit_for_approval: "Enviar para aprovação",
    approve: "Aprovar",
    reject: "Rejeitar",
  };

/** Whether `action` may be applied to a contract currently in `status`. */
export function canApply(
  status: string,
  action: ContractApprovalAction
): boolean {
  return (APPROVAL_ALLOWED[status] ?? []).includes(action);
}

/**
 * The status reached by applying `action` to a contract in `status`, or `null`
 * when the action is illegal from that status.
 */
export function applyApprovalAction(
  status: string,
  action: ContractApprovalAction
): string | null {
  if (!canApply(status, action)) return null;
  return APPROVAL_TARGET[action];
}

/** The approval actions available from a status (for rendering controls). */
export function availableApprovalActions(
  status: string
): ContractApprovalAction[] {
  return APPROVAL_ALLOWED[status] ?? [];
}

/**
 * A human-readable pt-BR sentence describing a single history entry, e.g.
 * "Rascunho → Em revisão" or "Criado como Rascunho" for the first entry.
 */
export function describeTransition(
  fromStatus: string | null,
  toStatus: string
): string {
  const to = CONTRACT_STATUS_LABELS[toStatus]?.label ?? toStatus;
  if (!fromStatus) return `Criado como ${to}`;
  const from = CONTRACT_STATUS_LABELS[fromStatus]?.label ?? fromStatus;
  return `${from} → ${to}`;
}
