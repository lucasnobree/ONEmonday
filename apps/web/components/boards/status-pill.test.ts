import { describe, it, expect } from "vitest";
import { statusPillMode } from "./status-pill";

describe("statusPillMode", () => {
  it("uses the hugging compact pill on a card", () => {
    expect(statusPillMode("card")).toBe("compact");
  });

  it("uses the full-bleed cell fill in a table", () => {
    expect(statusPillMode("table")).toBe("cell");
  });
});
