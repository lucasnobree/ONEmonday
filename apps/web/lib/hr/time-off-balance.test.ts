import { describe, it, expect } from "vitest";
import { checkTimeOffBalance, overBalanceMessage } from "./time-off-balance";

describe("checkTimeOffBalance", () => {
  it("accepts a request that fits within the balance", () => {
    const check = checkTimeOffBalance(10, 4);
    expect(check.withinBalance).toBe(true);
    expect(check.shortfall).toBe(0);
    expect(check.remaining).toBe(6);
  });

  it("accepts a request that uses the balance exactly", () => {
    const check = checkTimeOffBalance(5, 5);
    expect(check.withinBalance).toBe(true);
    expect(check.shortfall).toBe(0);
    expect(check.remaining).toBe(0);
  });

  it("flags a request that exceeds the balance", () => {
    const check = checkTimeOffBalance(3, 8);
    expect(check.withinBalance).toBe(false);
    expect(check.shortfall).toBe(5);
    expect(check.remaining).toBe(-5);
  });

  it("flags any request when the balance is already negative", () => {
    const check = checkTimeOffBalance(-2, 1);
    expect(check.withinBalance).toBe(false);
    expect(check.shortfall).toBe(3);
    expect(check.remaining).toBe(-3);
  });
});

describe("overBalanceMessage", () => {
  it("returns null when the request is within balance", () => {
    expect(overBalanceMessage(checkTimeOffBalance(10, 2))).toBeNull();
  });

  it("describes the shortfall for an over-balance request", () => {
    const msg = overBalanceMessage(checkTimeOffBalance(2, 7));
    expect(msg).toContain("5 dias");
    expect(msg).toContain("-5d");
  });

  it("uses the singular form for a one-day shortfall", () => {
    const msg = overBalanceMessage(checkTimeOffBalance(2, 3));
    expect(msg).toContain("1 dia.");
  });
});
