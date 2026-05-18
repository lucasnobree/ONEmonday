import { describe, it, expect } from "vitest";
import {
  canTransition,
  applyTransition,
  availableTransitions,
  transitionNeedsApprovalPermission,
} from "./expense-approval";

describe("canTransition", () => {
  it("allows submitting a pending expense", () => {
    expect(canTransition("pending", "submit")).toBe(true);
  });

  it("allows approving and rejecting a submitted expense", () => {
    expect(canTransition("submitted", "approve")).toBe(true);
    expect(canTransition("submitted", "reject")).toBe(true);
  });

  it("does not allow approving a pending expense (must submit first)", () => {
    expect(canTransition("pending", "approve")).toBe(false);
  });

  it("allows paying an approved expense", () => {
    expect(canTransition("approved", "pay")).toBe(true);
  });

  it("does not allow paying a submitted expense before approval", () => {
    expect(canTransition("submitted", "pay")).toBe(false);
  });

  it("allows resubmitting a rejected expense", () => {
    expect(canTransition("rejected", "submit")).toBe(true);
  });

  it("does not allow approving a paid expense", () => {
    expect(canTransition("paid", "approve")).toBe(false);
  });
});

describe("applyTransition", () => {
  it("moves submitted -> approved on approve", () => {
    expect(applyTransition("submitted", "approve")).toBe("approved");
  });

  it("moves approved -> paid on pay", () => {
    expect(applyTransition("approved", "pay")).toBe("paid");
  });

  it("returns null for an illegal transition", () => {
    expect(applyTransition("pending", "approve")).toBeNull();
    expect(applyTransition("void", "approve")).toBeNull();
  });

  it("reopens a paid expense back to pending", () => {
    expect(applyTransition("paid", "reopen")).toBe("pending");
  });
});

describe("availableTransitions", () => {
  it("lists the transitions a submitted expense supports", () => {
    expect(availableTransitions("submitted").sort()).toEqual(
      ["approve", "reject", "void"].sort()
    );
  });

  it("returns an empty-ish set for terminal-ish states", () => {
    expect(availableTransitions("paid")).toEqual(["reopen"]);
  });
});

describe("transitionNeedsApprovalPermission", () => {
  it("flags approve and reject as needing the approve permission", () => {
    expect(transitionNeedsApprovalPermission("approve")).toBe(true);
    expect(transitionNeedsApprovalPermission("reject")).toBe(true);
  });

  it("does not flag submit / pay / void", () => {
    expect(transitionNeedsApprovalPermission("submit")).toBe(false);
    expect(transitionNeedsApprovalPermission("pay")).toBe(false);
    expect(transitionNeedsApprovalPermission("void")).toBe(false);
  });
});
