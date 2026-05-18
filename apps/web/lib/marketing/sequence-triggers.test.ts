import { describe, it, expect } from "vitest";
import {
  SELECTABLE_SEQUENCE_TRIGGERS,
  sequenceTriggerOptions,
} from "./sequence-triggers";

describe("SELECTABLE_SEQUENCE_TRIGGERS", () => {
  it("excludes segment_entry (no auto-enroll job exists)", () => {
    expect(SELECTABLE_SEQUENCE_TRIGGERS).not.toContain("segment_entry");
  });

  it("offers the manual trigger", () => {
    expect(SELECTABLE_SEQUENCE_TRIGGERS).toContain("manual");
  });
});

describe("sequenceTriggerOptions", () => {
  it("returns only the supported triggers for a supported current value", () => {
    expect(sequenceTriggerOptions("manual")).toEqual(["manual"]);
  });

  it("re-adds an unsupported current value so legacy sequences keep it", () => {
    expect(sequenceTriggerOptions("segment_entry")).toEqual([
      "manual",
      "segment_entry",
    ]);
  });

  it("does not mutate the shared SELECTABLE_SEQUENCE_TRIGGERS array", () => {
    sequenceTriggerOptions("segment_entry");
    expect(SELECTABLE_SEQUENCE_TRIGGERS).toEqual(["manual"]);
  });
});
