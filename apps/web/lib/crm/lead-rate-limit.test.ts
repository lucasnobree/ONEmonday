import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  resetRateLimitState,
  RATE_LIMIT_MAX,
  WINDOW_MS,
} from "./lead-rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimitState());

  it("allows hits up to the cap then blocks", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      const r = checkRateLimit("ip-a", t0 + i);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(RATE_LIMIT_MAX - i - 1);
    }
    const blocked = checkRateLimit("ip-a", t0 + RATE_LIMIT_MAX);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("keeps separate windows per key", () => {
    const t0 = 2_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX; i++) checkRateLimit("ip-b", t0 + i);
    // A different key is unaffected.
    expect(checkRateLimit("ip-c", t0).allowed).toBe(true);
  });

  it("lets a caller through again once the window has passed", () => {
    const t0 = 3_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX; i++) checkRateLimit("ip-d", t0);
    expect(checkRateLimit("ip-d", t0).allowed).toBe(false);
    // After the window fully elapses, hits age out.
    expect(checkRateLimit("ip-d", t0 + WINDOW_MS + 1).allowed).toBe(true);
  });

  it("honours an overridden cap", () => {
    const t0 = 4_000_000;
    expect(checkRateLimit("ip-e", t0, 1).allowed).toBe(true);
    expect(checkRateLimit("ip-e", t0, 1).allowed).toBe(false);
  });
});
