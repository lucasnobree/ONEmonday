import { describe, it, expect } from "vitest";
import {
  daysUntilExpiry,
  getRenewalStatus,
  noticeDeadline,
  needsRenewalAttention,
  renewalOutcomeLabel,
  UPCOMING_WINDOW_DAYS,
} from "./renewal";

// Fixed reference date so the whole suite is deterministic.
const NOW = new Date("2026-05-15T12:00:00Z");

describe("daysUntilExpiry", () => {
  it("returns null when no expiry date is given", () => {
    expect(daysUntilExpiry(null, NOW)).toBeNull();
    expect(daysUntilExpiry(undefined, NOW)).toBeNull();
  });

  it("returns null for an unparseable date", () => {
    expect(daysUntilExpiry("not-a-date", NOW)).toBeNull();
  });

  it("returns 0 for an expiry on the same day", () => {
    expect(daysUntilExpiry("2026-05-15", NOW)).toBe(0);
  });

  it("returns a positive count for a future expiry", () => {
    expect(daysUntilExpiry("2026-06-14", NOW)).toBe(30);
  });

  it("returns a negative count for a past expiry", () => {
    expect(daysUntilExpiry("2026-05-05", NOW)).toBe(-10);
  });
});

describe("getRenewalStatus", () => {
  it("is 'none' without an expiry date", () => {
    expect(getRenewalStatus(null, 30, NOW)).toBe("none");
  });

  it("is 'expired' once the expiry date has passed", () => {
    expect(getRenewalStatus("2026-05-14", 30, NOW)).toBe("expired");
  });

  it("is 'notice' inside the termination-notice window", () => {
    // 30-day notice window, contract expires in 20 days -> action needed now.
    expect(getRenewalStatus("2026-06-04", 30, NOW)).toBe("notice");
  });

  it("is 'notice' exactly on the notice-window boundary", () => {
    // Expires in exactly 30 days with a 30-day notice window.
    expect(getRenewalStatus("2026-06-14", 30, NOW)).toBe("notice");
  });

  it("is 'upcoming' past the notice window but within the upcoming window", () => {
    // Expires in 60 days, notice window is 30 days.
    expect(getRenewalStatus("2026-07-14", 30, NOW)).toBe("upcoming");
  });

  it("is 'upcoming' exactly on the upcoming-window boundary", () => {
    const boundary = new Date(NOW);
    boundary.setUTCDate(boundary.getUTCDate() + UPCOMING_WINDOW_DAYS);
    const iso = boundary.toISOString().slice(0, 10);
    expect(getRenewalStatus(iso, 30, NOW)).toBe("upcoming");
  });

  it("is 'ok' beyond the upcoming window", () => {
    const beyond = new Date(NOW);
    beyond.setUTCDate(beyond.getUTCDate() + UPCOMING_WINDOW_DAYS + 1);
    const iso = beyond.toISOString().slice(0, 10);
    expect(getRenewalStatus(iso, 30, NOW)).toBe("ok");
  });

  it("treats a zero-day notice window so expiry-day is still 'notice'", () => {
    expect(getRenewalStatus("2026-05-15", 0, NOW)).toBe("notice");
    expect(getRenewalStatus("2026-05-16", 0, NOW)).toBe("upcoming");
  });

  it("clamps a negative notice period to zero", () => {
    expect(getRenewalStatus("2026-05-16", -10, NOW)).toBe("upcoming");
  });
});

describe("noticeDeadline", () => {
  it("returns null without an expiry date", () => {
    expect(noticeDeadline(null, 30)).toBeNull();
  });

  it("subtracts the notice period from the expiry date", () => {
    expect(noticeDeadline("2026-06-14", 30)).toBe("2026-05-15");
  });

  it("returns the expiry date itself for a zero notice period", () => {
    expect(noticeDeadline("2026-06-14", 0)).toBe("2026-06-14");
  });

  it("handles month boundaries correctly", () => {
    expect(noticeDeadline("2026-03-01", 1)).toBe("2026-02-28");
  });
});

describe("needsRenewalAttention", () => {
  it("flags 'notice' and 'expired'", () => {
    expect(needsRenewalAttention("notice")).toBe(true);
    expect(needsRenewalAttention("expired")).toBe(true);
  });

  it("does not flag 'ok', 'upcoming' or 'none'", () => {
    expect(needsRenewalAttention("ok")).toBe(false);
    expect(needsRenewalAttention("upcoming")).toBe(false);
    expect(needsRenewalAttention("none")).toBe(false);
  });
});

describe("renewalOutcomeLabel", () => {
  it("describes each renewal type", () => {
    expect(renewalOutcomeLabel("auto")).toMatch(/automaticamente/i);
    expect(renewalOutcomeLabel("optional")).toMatch(/opcional/i);
    expect(renewalOutcomeLabel("none")).toBe("Não renova");
  });

  it("renders pt-BR labels with the correct diacritics", () => {
    // Regression: accents were previously stripped from these labels.
    expect(renewalOutcomeLabel("optional")).toBe("Renovação opcional");
    expect(renewalOutcomeLabel("none")).toBe("Não renova");
  });
});
