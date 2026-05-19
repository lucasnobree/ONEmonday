import { describe, it, expect } from "vitest";
import {
  resolveStatusColor,
  statusTextColor,
  EMPTY_STATUS_COLOR,
  PRIORITY_STATUS_COLOR,
  STATUS_PALETTE,
} from "./status-colors";

describe("resolveStatusColor", () => {
  it("returns the given color when set", () => {
    expect(resolveStatusColor("#00C875")).toBe("#00C875");
  });

  it("falls back to the neutral empty swatch for null", () => {
    expect(resolveStatusColor(null)).toBe(EMPTY_STATUS_COLOR);
  });

  it("falls back to the neutral empty swatch for undefined", () => {
    expect(resolveStatusColor(undefined)).toBe(EMPTY_STATUS_COLOR);
  });

  it("treats a blank/whitespace string as empty", () => {
    expect(resolveStatusColor("   ")).toBe(EMPTY_STATUS_COLOR);
    expect(resolveStatusColor("")).toBe(EMPTY_STATUS_COLOR);
  });

  it("trims surrounding whitespace from a real color", () => {
    expect(resolveStatusColor("  #E2445C  ")).toBe("#E2445C");
  });
});

describe("statusTextColor", () => {
  it("uses white text on dark green (done)", () => {
    expect(statusTextColor(STATUS_PALETTE.green)).toBe("#FFFFFF");
  });

  it("uses white text on red (stuck)", () => {
    expect(statusTextColor(STATUS_PALETTE.red)).toBe("#FFFFFF");
  });

  it("uses dark text on bright yellow", () => {
    expect(statusTextColor(STATUS_PALETTE.yellow)).toBe("#323338");
  });

  it("uses dark text on near-white", () => {
    expect(statusTextColor("#FFFFFF")).toBe("#323338");
  });

  it("uses white text on black", () => {
    expect(statusTextColor("#000000")).toBe("#FFFFFF");
  });

  it("accepts 3-digit shorthand hex", () => {
    expect(statusTextColor("#fff")).toBe("#323338");
    expect(statusTextColor("#000")).toBe("#FFFFFF");
  });

  it("defaults to white text for a malformed hex", () => {
    expect(statusTextColor("not-a-color")).toBe("#FFFFFF");
  });
});

describe("PRIORITY_STATUS_COLOR", () => {
  it("maps every priority to a palette swatch", () => {
    expect(PRIORITY_STATUS_COLOR.critical).toBe(STATUS_PALETTE.red);
    expect(PRIORITY_STATUS_COLOR.high).toBe(STATUS_PALETTE.orange);
    expect(PRIORITY_STATUS_COLOR.medium).toBe(STATUS_PALETTE.yellow);
    expect(PRIORITY_STATUS_COLOR.low).toBe(STATUS_PALETTE.green);
  });
});
