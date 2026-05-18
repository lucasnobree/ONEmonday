import { describe, it, expect } from "vitest";
import {
  canApply,
  applyApprovalAction,
  availableApprovalActions,
  describeTransition,
  CONTRACT_APPROVAL_LABELS,
} from "./status-history";

describe("canApply", () => {
  it("allows submit-for-approval only from draft", () => {
    expect(canApply("draft", "submit_for_approval")).toBe(true);
    expect(canApply("in_review", "submit_for_approval")).toBe(false);
    expect(canApply("active", "submit_for_approval")).toBe(false);
  });

  it("allows approve / reject only from in_review", () => {
    expect(canApply("in_review", "approve")).toBe(true);
    expect(canApply("in_review", "reject")).toBe(true);
    expect(canApply("draft", "approve")).toBe(false);
    expect(canApply("approved", "reject")).toBe(false);
  });

  it("returns false for a status with no approval actions", () => {
    expect(canApply("terminated", "approve")).toBe(false);
    expect(canApply("expired", "submit_for_approval")).toBe(false);
  });
});

describe("applyApprovalAction", () => {
  it("submits a draft into in_review", () => {
    expect(applyApprovalAction("draft", "submit_for_approval")).toBe(
      "in_review"
    );
  });

  it("approves an in_review contract", () => {
    expect(applyApprovalAction("in_review", "approve")).toBe("approved");
  });

  it("rejects an in_review contract back to draft", () => {
    expect(applyApprovalAction("in_review", "reject")).toBe("draft");
  });

  it("returns null for an illegal action from the current status", () => {
    expect(applyApprovalAction("active", "approve")).toBeNull();
    expect(applyApprovalAction("draft", "reject")).toBeNull();
  });
});

describe("availableApprovalActions", () => {
  it("offers submit-for-approval from draft", () => {
    expect(availableApprovalActions("draft")).toEqual(["submit_for_approval"]);
  });

  it("offers approve and reject from in_review", () => {
    expect(availableApprovalActions("in_review")).toEqual([
      "approve",
      "reject",
    ]);
  });

  it("offers nothing from a non-approval status", () => {
    expect(availableApprovalActions("active")).toEqual([]);
    expect(availableApprovalActions("terminated")).toEqual([]);
  });
});

describe("describeTransition", () => {
  it("describes the creation entry when from_status is null", () => {
    expect(describeTransition(null, "draft")).toBe("Criado como Rascunho");
  });

  it("describes a transition with pt-BR labels", () => {
    expect(describeTransition("draft", "in_review")).toBe(
      "Rascunho → Em revisão"
    );
    expect(describeTransition("in_review", "approved")).toBe(
      "Em revisão → Aprovado"
    );
  });

  it("falls back to the raw status when it has no label", () => {
    expect(describeTransition("draft", "weird_status")).toBe(
      "Rascunho → weird_status"
    );
  });
});

describe("CONTRACT_APPROVAL_LABELS", () => {
  it("has an accented pt-BR label for every approval action", () => {
    expect(CONTRACT_APPROVAL_LABELS.submit_for_approval).toBe(
      "Enviar para aprovação"
    );
    expect(CONTRACT_APPROVAL_LABELS.approve).toBe("Aprovar");
    expect(CONTRACT_APPROVAL_LABELS.reject).toBe("Rejeitar");
  });
});
