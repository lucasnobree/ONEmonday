import { describe, it, expect, afterEach } from "vitest";
import {
  safeEqual,
  hasCronSecret,
  extractPresentedSecret,
  isAuthorizedCronRequest,
} from "./auth";

/** Builds a Headers object from a plain map. */
function headers(map: Record<string, string>): Headers {
  return new Headers(map);
}

const ORIGINAL_SECRET = process.env.CRON_SECRET;

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = ORIGINAL_SECRET;
  }
});

describe("safeEqual", () => {
  it("is true for equal strings", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
  });

  it("is false for different strings of equal length", () => {
    expect(safeEqual("abc123", "abc124")).toBe(false);
  });

  it("is false for different-length strings without throwing", () => {
    expect(safeEqual("short", "a-much-longer-secret")).toBe(false);
  });
});

describe("hasCronSecret", () => {
  it("is false when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    expect(hasCronSecret()).toBe(false);
  });

  it("is false when CRON_SECRET is blank whitespace", () => {
    process.env.CRON_SECRET = "   ";
    expect(hasCronSecret()).toBe(false);
  });

  it("is true when CRON_SECRET is set", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(hasCronSecret()).toBe(true);
  });
});

describe("extractPresentedSecret", () => {
  it("reads a Bearer authorization header", () => {
    expect(
      extractPresentedSecret(headers({ authorization: "Bearer my-secret" }))
    ).toBe("my-secret");
  });

  it("is case-insensitive on the Bearer scheme", () => {
    expect(
      extractPresentedSecret(headers({ authorization: "bearer my-secret" }))
    ).toBe("my-secret");
  });

  it("reads the x-cron-secret header", () => {
    expect(
      extractPresentedSecret(headers({ "x-cron-secret": "my-secret" }))
    ).toBe("my-secret");
  });

  it("returns an empty string when neither header is present", () => {
    expect(extractPresentedSecret(headers({}))).toBe("");
  });
});

describe("isAuthorizedCronRequest", () => {
  it("rejects when CRON_SECRET is unset (fails closed)", () => {
    delete process.env.CRON_SECRET;
    expect(
      isAuthorizedCronRequest(headers({ authorization: "Bearer anything" }))
    ).toBe(false);
  });

  it("rejects a request with no secret header", () => {
    process.env.CRON_SECRET = "the-secret";
    expect(isAuthorizedCronRequest(headers({}))).toBe(false);
  });

  it("rejects a request with the wrong secret", () => {
    process.env.CRON_SECRET = "the-secret";
    expect(
      isAuthorizedCronRequest(headers({ authorization: "Bearer wrong" }))
    ).toBe(false);
  });

  it("accepts a request with the right bearer secret", () => {
    process.env.CRON_SECRET = "the-secret";
    expect(
      isAuthorizedCronRequest(headers({ authorization: "Bearer the-secret" }))
    ).toBe(true);
  });

  it("accepts a request with the right x-cron-secret header", () => {
    process.env.CRON_SECRET = "the-secret";
    expect(
      isAuthorizedCronRequest(headers({ "x-cron-secret": "the-secret" }))
    ).toBe(true);
  });
});
