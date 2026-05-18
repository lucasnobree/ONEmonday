import { describe, it, expect } from "vitest";
import {
  isTerminalStage,
  stageOrder,
  isForwardMove,
  pipelineSummary,
  isJobOpeningStatus,
  allowedStatusTransitions,
  canTransitionStatus,
  JOB_OPENING_STATUSES,
} from "./recruitment";

describe("isTerminalStage", () => {
  it("recognises hired and rejected as terminal", () => {
    expect(isTerminalStage("hired")).toBe(true);
    expect(isTerminalStage("rejected")).toBe(true);
  });

  it("treats funnel stages as non-terminal", () => {
    expect(isTerminalStage("applied")).toBe(false);
    expect(isTerminalStage("interview")).toBe(false);
  });
});

describe("stageOrder", () => {
  it("orders the canonical pipeline", () => {
    expect(stageOrder("applied")).toBe(0);
    expect(stageOrder("screening")).toBe(1);
    expect(stageOrder("interview")).toBe(2);
    expect(stageOrder("offer")).toBe(3);
  });

  it("returns -1 for an unknown stage", () => {
    expect(stageOrder("nonexistent")).toBe(-1);
  });
});

describe("isForwardMove", () => {
  it("allows progressing down the funnel", () => {
    expect(isForwardMove("applied", "screening")).toBe(true);
    expect(isForwardMove("screening", "interview")).toBe(true);
  });

  it("rejects moving backwards", () => {
    expect(isForwardMove("interview", "applied")).toBe(false);
  });

  it("rejects moving to the same stage", () => {
    expect(isForwardMove("offer", "offer")).toBe(false);
  });

  it("always allows moving into a terminal stage", () => {
    expect(isForwardMove("applied", "rejected")).toBe(true);
    expect(isForwardMove("offer", "hired")).toBe(true);
  });

  it("rejects unknown stages", () => {
    expect(isForwardMove("applied", "bogus")).toBe(false);
  });
});

describe("pipelineSummary", () => {
  it("counts an empty pipeline", () => {
    expect(pipelineSummary([])).toEqual({
      active: 0,
      hired: 0,
      rejected: 0,
      total: 0,
    });
  });

  it("buckets candidates by outcome", () => {
    const summary = pipelineSummary([
      "applied",
      "screening",
      "interview",
      "hired",
      "rejected",
      "rejected",
    ]);
    expect(summary).toEqual({
      active: 3,
      hired: 1,
      rejected: 2,
      total: 6,
    });
  });
});

describe("isJobOpeningStatus", () => {
  it("recognises every canonical status", () => {
    for (const status of JOB_OPENING_STATUSES) {
      expect(isJobOpeningStatus(status)).toBe(true);
    }
  });

  it("rejects an unknown status", () => {
    expect(isJobOpeningStatus("archived")).toBe(false);
    expect(isJobOpeningStatus("")).toBe(false);
  });
});

describe("allowedStatusTransitions", () => {
  it("lets an open vaga be closed, filled or cancelled", () => {
    expect(allowedStatusTransitions("open")).toEqual([
      "closed",
      "filled",
      "cancelled",
    ]);
  });

  it("only lets a non-open vaga be reopened", () => {
    expect(allowedStatusTransitions("closed")).toEqual(["open"]);
    expect(allowedStatusTransitions("filled")).toEqual(["open"]);
    expect(allowedStatusTransitions("cancelled")).toEqual(["open"]);
  });

  it("offers nothing for an unknown status", () => {
    expect(allowedStatusTransitions("archived")).toEqual([]);
  });
});

describe("canTransitionStatus", () => {
  it("allows a legal transition", () => {
    expect(canTransitionStatus("open", "filled")).toBe(true);
    expect(canTransitionStatus("closed", "open")).toBe(true);
  });

  it("rejects re-selecting the current status", () => {
    expect(canTransitionStatus("open", "open")).toBe(false);
    expect(canTransitionStatus("filled", "filled")).toBe(false);
  });

  it("rejects moving directly between two non-open statuses", () => {
    expect(canTransitionStatus("closed", "filled")).toBe(false);
    expect(canTransitionStatus("filled", "cancelled")).toBe(false);
  });

  it("rejects an unknown source or target status", () => {
    expect(canTransitionStatus("archived", "open")).toBe(false);
    expect(canTransitionStatus("open", "archived")).toBe(false);
  });
});
