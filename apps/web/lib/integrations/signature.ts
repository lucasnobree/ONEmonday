/**
 * Inbound-webhook signature verification.
 *
 * Every inbound webhook is verified BEFORE its payload is acted on
 * (docs/research/migration-architecture.md §1.2c). Different providers sign
 * differently, so each has its own verifier — but all reduce to a constant-time
 * comparison of an HMAC-SHA256 over the raw request body.
 *
 *   * WhatsApp / Meta — sends `X-Hub-Signature-256: sha256=<hex>`, an HMAC of
 *     the raw body keyed by the app secret.
 *   * Teams — a Workflow can be configured to send a shared secret; we verify
 *     it as an HMAC over the raw body keyed by that secret, matching the
 *     `Authorization`/`X-Webhook-Signature` header.
 *
 * Server-only — uses Node's `crypto`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Computes the base64 HMAC-SHA256 of `body` keyed by a raw key buffer.
 * Used by the Svix verifier, whose signing secret is a base64-encoded key.
 */
function hmacSha256Base64Raw(key: Buffer, body: string): string {
  return createHmac("sha256", key).update(body, "utf8").digest("base64");
}

/** Constant-time string comparison that never throws on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Computes the lowercase hex HMAC-SHA256 of `body` keyed by `secret`. */
export function hmacSha256Hex(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

/**
 * Verifies a Meta / WhatsApp `X-Hub-Signature-256` header.
 * The header form is `sha256=<hex>`; `secret` is the Meta app secret.
 */
export function verifyMetaSignature(
  appSecret: string,
  rawBody: string,
  header: string | null
): boolean {
  if (!appSecret || !header) return false;
  const expected = `sha256=${hmacSha256Hex(appSecret, rawBody)}`;
  return safeEqual(expected, header.trim());
}

/**
 * Verifies a generic shared-secret HMAC signature (used for the Teams
 * Workflow channel). `header` is the raw hex digest sent by the caller.
 */
export function verifyHmacSignature(
  secret: string,
  rawBody: string,
  header: string | null
): boolean {
  if (!secret || !header) return false;
  const expected = hmacSha256Hex(secret, rawBody);
  // Tolerate an optional `sha256=` prefix.
  const provided = header.trim().replace(/^sha256=/i, "");
  return safeEqual(expected, provided);
}

/**
 * Verifies an Asaas payment-gateway webhook.
 *
 * Unlike Meta / Teams, Asaas does NOT HMAC-sign the request body: it sends a
 * *static* shared token in the `asaas-access-token` header — the value the
 * operator configured in the Asaas webhook settings. Authentication is a
 * constant-time direct compare of that header against the stored token; there
 * is no body digest to compute. Fails closed when either side is empty.
 */
export function verifyStaticToken(
  storedToken: string,
  header: string | null
): boolean {
  if (!storedToken || !header) return false;
  return safeEqual(storedToken, header.trim());
}

/**
 * Verifies a Svix-style webhook signature — the scheme Resend uses for its
 * inbound-email and email-event webhooks.
 *
 * Svix signs the string `{svix-id}.{svix-timestamp}.{rawBody}` with HMAC-SHA256
 * keyed by the webhook signing secret, which is delivered as `whsec_<base64>`
 * (the `whsec_` prefix is stripped and the remainder base64-decoded to the raw
 * key). The `svix-signature` header carries one or more space-separated
 * `v1,<base64sig>` tokens — a signed body matches when ANY token's signature
 * equals the expected one (Svix rotates secrets by sending multiple).
 *
 * Fails closed when the secret or any header is missing.
 */
export function verifySvixSignature(
  signingSecret: string,
  svixId: string | null,
  svixTimestamp: string | null,
  rawBody: string,
  signatureHeader: string | null
): boolean {
  if (!signingSecret || !svixId || !svixTimestamp || !signatureHeader) {
    return false;
  }

  // The signing secret is `whsec_<base64>`; the raw HMAC key is the decoded
  // remainder. A secret with no prefix is decoded as-is.
  const secretB64 = signingSecret.startsWith("whsec_")
    ? signingSecret.slice("whsec_".length)
    : signingSecret;
  let key: Buffer;
  try {
    key = Buffer.from(secretB64, "base64");
  } catch {
    return false;
  }
  if (key.length === 0) return false;

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = hmacSha256Base64Raw(key, signedContent);

  // The header is space-separated `v<n>,<sig>` tokens — accept any v1 match.
  for (const token of signatureHeader.trim().split(/\s+/)) {
    const comma = token.indexOf(",");
    if (comma === -1) continue;
    const version = token.slice(0, comma);
    const sig = token.slice(comma + 1);
    if (version === "v1" && safeEqual(expected, sig)) {
      return true;
    }
  }
  return false;
}
