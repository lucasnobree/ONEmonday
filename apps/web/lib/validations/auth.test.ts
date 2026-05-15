import { describe, it, expect } from "vitest";
import { loginSchema, recoverySchema, setPasswordSchema } from "./auth";

describe("loginSchema", () => {
  it("accepts a valid email and password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 6 characters", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "abc",
    });
    expect(result.success).toBe(false);
  });
});

describe("recoverySchema", () => {
  it("accepts a valid email", () => {
    expect(recoverySchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });

  it("rejects a missing email", () => {
    expect(recoverySchema.safeParse({}).success).toBe(false);
  });
});

describe("setPasswordSchema", () => {
  it("accepts matching passwords of at least 8 characters", () => {
    const result = setPasswordSchema.safeParse({
      password: "longenough",
      confirmPassword: "longenough",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords on the confirmPassword path", () => {
    const result = setPasswordSchema.safeParse({
      password: "longenough",
      confirmPassword: "different1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("confirmPassword");
    }
  });
});
