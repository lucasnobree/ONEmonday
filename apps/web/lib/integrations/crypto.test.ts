import { describe, it, expect } from "vitest";
import {
  encryptSecret,
  decryptSecret,
  encryptSecretJson,
  decryptSecretJson,
  isValidKeyHex,
  isUsingDevKey,
} from "./crypto";

describe("integration crypto", () => {
  it("round-trips a plaintext string", () => {
    const plain = "super-secret-webhook-url";
    const envelope = encryptSecret(plain);
    expect(envelope).not.toContain(plain);
    expect(decryptSecret(envelope)).toBe(plain);
  });

  it("produces the three-part iv.tag.ciphertext envelope", () => {
    const envelope = encryptSecret("x");
    expect(envelope.split(".")).toHaveLength(3);
  });

  it("uses a fresh IV each call (different ciphertext for same input)", () => {
    const a = encryptSecret("same-input");
    const b = encryptSecret("same-input");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("round-trips a JSON secret object", () => {
    const secret = { accessToken: "EAAB123", phoneNumberId: "55119" };
    const envelope = encryptSecretJson(secret);
    expect(decryptSecretJson(envelope)).toEqual(secret);
  });

  it("rejects a malformed envelope", () => {
    expect(() => decryptSecret("not-an-envelope")).toThrow(/Malformed/);
  });

  it("rejects a tampered ciphertext (auth tag fails)", () => {
    const envelope = encryptSecret("integrity-protected");
    const [iv, tag] = envelope.split(".");
    // Flip the ciphertext.
    const tampered = [iv, tag, Buffer.from("evil").toString("base64")].join(
      "."
    );
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("validates key hex format", () => {
    expect(isValidKeyHex("a".repeat(64))).toBe(true);
    expect(isValidKeyHex("a".repeat(63))).toBe(false);
    expect(isValidKeyHex("zz" + "a".repeat(62))).toBe(false);
  });

  it("reports the dev key when no env key is configured", () => {
    // The test environment sets no INTEGRATION_ENCRYPTION_KEY.
    expect(isUsingDevKey()).toBe(true);
  });
});
