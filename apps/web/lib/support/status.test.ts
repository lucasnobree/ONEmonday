import { describe, it, expect } from "vitest";
import {
  TICKET_STATUS_META,
  TICKET_STATUS_OPTIONS,
  normalizeTicketStatus,
} from "./status";
import { TICKET_STATUSES } from "./sla";

describe("TICKET_STATUS_META", () => {
  it("has metadata for every status", () => {
    for (const status of TICKET_STATUSES) {
      expect(TICKET_STATUS_META[status]).toBeDefined();
      expect(TICKET_STATUS_META[status].label.length).toBeGreaterThan(0);
    }
  });
});

describe("TICKET_STATUS_OPTIONS", () => {
  it("lists the statuses in workflow order", () => {
    expect(TICKET_STATUS_OPTIONS.map((o) => o.value)).toEqual([
      "new",
      "open",
      "pending",
      "on_hold",
      "resolved",
    ]);
  });
});

describe("normalizeTicketStatus", () => {
  it("passes through a known status", () => {
    expect(normalizeTicketStatus("pending")).toBe("pending");
  });

  it("falls back to new for unknown or empty values", () => {
    expect(normalizeTicketStatus("garbage")).toBe("new");
    expect(normalizeTicketStatus(null)).toBe("new");
    expect(normalizeTicketStatus(undefined)).toBe("new");
  });
});
