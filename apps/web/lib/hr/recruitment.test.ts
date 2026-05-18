import { describe, it, expect } from "vitest";
import {
  isTerminalStage,
  stageOrder,
  isForwardMove,
  pipelineSummary,
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
