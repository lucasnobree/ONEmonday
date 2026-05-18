import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  safeEqual,
  hmacSha256Hex,
  verifyMetaSignature,
  verifyHmacSignature,
  verifyStaticToken,
  verifySvixSignature,
} from "./signature";

describe("integration signature verification", () => {
  it("safeEqual matches identical strings and rejects others", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });

  it("hmacSha256Hex is deterministic", () => {
    const a = hmacSha256Hex("key", "body");
    const b = hmacSha256Hex("key", "body");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  describe("verifyMetaSignature (WhatsApp / X-Hub-Signature-256)", () => {
    const appSecret = "meta-app-secret";
    const body = '{"entry":[{"id":"1"}]}';
    const header = `sha256=${hmacSha256Hex(appSecret, body)}`;

    it("accepts a correctly signed body", () => {
      expect(verifyMetaSignature(appSecret, body, header)).toBe(true);
    });

    it("rejects a wrong signature", () => {
      expect(verifyMetaSignature(appSecret, body, "sha256=deadbeef")).toBe(
        false
      );
    });

    it("rejects a tampered body", () => {
      expect(
        verifyMetaSignature(appSecret, body + "tampered", header)
      ).toBe(false);
    });

    it("rejects a missing header", () => {
      expect(verifyMetaSignature(appSecret, body, null)).toBe(false);
    });

    it("rejects an empty app secret", () => {
      expect(verifyMetaSignature("", body, header)).toBe(false);
    });
  });

  describe("verifyHmacSignature (Teams shared-secret HMAC)", () => {
    const secret = "teams-workflow-secret";
    const body = '{"id":"evt-1"}';
    const digest = hmacSha256Hex(secret, body);

    it("accepts a raw hex digest", () => {
      expect(verifyHmacSignature(secret, body, digest)).toBe(true);
    });

    it("accepts an optional sha256= prefix", () => {
      expect(verifyHmacSignature(secret, body, `sha256=${digest}`)).toBe(true);
    });

    it("rejects a wrong digest", () => {
      expect(verifyHmacSignature(secret, body, "00".repeat(32))).toBe(false);
    });

    it("rejects a missing header or empty secret", () => {
      expect(verifyHmacSignature(secret, body, null)).toBe(false);
      expect(verifyHmacSignature("", body, digest)).toBe(false);
    });
  });

  // Regression — Finance B1: Asaas sends a STATIC `asaas-access-token`, not an
  // HMAC. It must be verified by a timing-safe direct compare of the stored
  // token vs. the header — NOT by verifyHmacSignature (which would always
  // reject, since the static token is not a digest of the body).
  describe("verifyStaticToken (Asaas asaas-access-token)", () => {
    const token = "asaas-shared-token-xyz";

    it("accepts the exact stored token", () => {
      expect(verifyStaticToken(token, token)).toBe(true);
    });

    it("accepts a header with surrounding whitespace", () => {
      expect(verifyStaticToken(token, `  ${token}  `)).toBe(true);
    });

    it("rejects a wrong token", () => {
      expect(verifyStaticToken(token, "wrong-token")).toBe(false);
    });

    it("rejects a missing header or empty stored token (fails closed)", () => {
      expect(verifyStaticToken(token, null)).toBe(false);
      expect(verifyStaticToken("", token)).toBe(false);
      expect(verifyStaticToken("", null)).toBe(false);
    });

    it("does NOT treat the token as an HMAC of the body", () => {
      // The mistaken HMAC approach would compute hmac(token, body) and never
      // match the static token. The direct compare matches the token itself.
      const body = '{"event":"PAYMENT_RECEIVED"}';
      expect(verifyStaticToken(token, token)).toBe(true);
      expect(verifyHmacSignature(token, body, token)).toBe(false);
    });
  });

  describe("verifySvixSignature (Resend inbound-email webhook)", () => {
    // A `whsec_<base64>` signing secret and the matching v1 signature for a
    // given id/timestamp/body — computed exactly like Svix does.
    const rawKey = Buffer.from("resend-inbound-signing-key-0001");
    const signingSecret = `whsec_${rawKey.toString("base64")}`;
    const svixId = "msg_2abc";
    const svixTimestamp = "1747555200";
    const body = '{"type":"inbound.email.received","data":{"id":"email_1"}}';

    function sign(key: Buffer, id: string, ts: string, b: string): string {
      return createHmac("sha256", key)
        .update(`${id}.${ts}.${b}`, "utf8")
        .digest("base64");
    }
    const validSig = `v1,${sign(rawKey, svixId, svixTimestamp, body)}`;

    it("accepts a correctly signed body", () => {
      expect(
        verifySvixSignature(
          signingSecret,
          svixId,
          svixTimestamp,
          body,
          validSig
        )
      ).toBe(true);
    });

    it("accepts a secret with no `whsec_` prefix", () => {
      expect(
        verifySvixSignature(
          rawKey.toString("base64"),
          svixId,
          svixTimestamp,
          body,
          validSig
        )
      ).toBe(true);
    });

    it("accepts any matching token among space-separated rotated signatures", () => {
      const header = `v1,${"A".repeat(44)} ${validSig}`;
      expect(
        verifySvixSignature(signingSecret, svixId, svixTimestamp, body, header)
      ).toBe(true);
    });

    it("rejects a tampered body", () => {
      expect(
        verifySvixSignature(
          signingSecret,
          svixId,
          svixTimestamp,
          body + "x",
          validSig
        )
      ).toBe(false);
    });

    it("rejects when the timestamp differs from the signed one", () => {
      expect(
        verifySvixSignature(
          signingSecret,
          svixId,
          "1747555999",
          body,
          validSig
        )
      ).toBe(false);
    });

    it("rejects a non-v1 signature version", () => {
      const v0 = `v0,${sign(rawKey, svixId, svixTimestamp, body)}`;
      expect(
        verifySvixSignature(signingSecret, svixId, svixTimestamp, body, v0)
      ).toBe(false);
    });

    it("fails closed on a missing secret or header (LGPD-safe)", () => {
      expect(
        verifySvixSignature("", svixId, svixTimestamp, body, validSig)
      ).toBe(false);
      expect(
        verifySvixSignature(signingSecret, null, svixTimestamp, body, validSig)
      ).toBe(false);
      expect(
        verifySvixSignature(signingSecret, svixId, null, body, validSig)
      ).toBe(false);
      expect(
        verifySvixSignature(signingSecret, svixId, svixTimestamp, body, null)
      ).toBe(false);
    });
  });
});
