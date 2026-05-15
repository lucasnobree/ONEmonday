import { describe, it, expect } from "vitest";
import {
  daysUntilExpiry,
  getExpiryStatus,
  EXPIRY_SOON_DAYS,
} from "./document-expiry";

// Fixed reference date so the suite is deterministic.
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
    expect(daysUntilExpiry("2026-05-25", NOW)).toBe(10);
  });

  it("returns a negative count for a past expiry", () => {
    expect(daysUntilExpiry("2026-05-05", NOW)).toBe(-10);
  });
});

describe("getExpiryStatus", () => {
  it("is 'none' without an expiry date", () => {
    expect(getExpiryStatus(null, NOW)).toBe("none");
  });

  it("is 'expired' once the date has passed", () => {
    expect(getExpiryStatus("2026-05-14", NOW)).toBe("expired");
  });

  it("is 'expiring' on the expiry day itself", () => {
    expect(getExpiryStatus("2026-05-15", NOW)).toBe("expiring");
  });

  it("is 'expiring' within the soon-window boundary", () => {
    const boundary = new Date(NOW);
    boundary.setUTCDate(boundary.getUTCDate() + EXPIRY_SOON_DAYS);
    const iso = boundary.toISOString().slice(0, 10);
    expect(getExpiryStatus(iso, NOW)).toBe("expiring");
  });

  it("is 'valid' beyond the soon-window", () => {
    const beyond = new Date(NOW);
    beyond.setUTCDate(beyond.getUTCDate() + EXPIRY_SOON_DAYS + 1);
    const iso = beyond.toISOString().slice(0, 10);
    expect(getExpiryStatus(iso, NOW)).toBe("valid");
  });
});
