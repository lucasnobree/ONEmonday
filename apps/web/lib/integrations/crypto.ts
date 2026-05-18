/**
 * Application-level secret encryption for the integration layer.
 *
 * Provider credentials (Teams webhook URLs, WhatsApp Cloud API tokens, ...)
 * MUST NOT be stored in plaintext. They are encrypted here with AES-256-GCM
 * before being written to `integration_credentials.secret` and decrypted only
 * inside server-only code (server actions / webhook routes).
 *
 * Key management — the AES key comes from the `INTEGRATION_ENCRYPTION_KEY`
 * environment variable: a 64-hex-character (32-byte) string. Generate one with:
 *
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * In development, when the variable is unset, a fixed well-known DEV key is
 * used so the app and tests run without configuration. That dev key is NEVER
 * acceptable in production — `assertProductionKey()` enforces this.
 *
 * Ciphertext envelope format (a single string, safe for a text column):
 *
 *   base64(iv) "." base64(authTag) "." base64(ciphertext)
 *
 * This module is server-only — it uses Node's `crypto`.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, the GCM recommendation.

/**
 * Fixed development key. Deterministic so dev/test runs are reproducible and
 * need no configuration. Unsafe for production — see `assertProductionKey`.
 */
const DEV_KEY_HEX =
  "0000000000000000000000000000000000000000000000000000000000000000";

/** Reads the configured key as hex, falling back to the dev key. */
function getKeyHex(): string {
  return process.env.INTEGRATION_ENCRYPTION_KEY?.trim() || DEV_KEY_HEX;
}

/** True when encryption is running on the insecure development key. */
export function isUsingDevKey(): boolean {
  return getKeyHex() === DEV_KEY_HEX;
}

/**
 * Throws if the process is in production but no real key is configured.
 * Call this from production-sensitive entry points (e.g. credential writes).
 */
export function assertProductionKey(): void {
  if (process.env.NODE_ENV === "production" && isUsingDevKey()) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY is not set — refusing to encrypt secrets " +
        "with the development key in production."
    );
  }
}

/** Resolves and validates the 32-byte AES key buffer. */
function getKey(): Buffer {
  const hex = getKeyHex();
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes)."
    );
  }
  return Buffer.from(hex, "hex");
}

/** Encrypts a plaintext string into the `iv.tag.ciphertext` envelope. */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

/**
 * Decrypts an `iv.tag.ciphertext` envelope back to plaintext.
 * Throws if the envelope is malformed or the auth tag fails (tampering).
 */
export function decryptSecret(envelope: string): string {
  const parts = envelope.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed integration secret envelope.");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const key = getKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Encrypts an arbitrary JSON-serialisable secret object. */
export function encryptSecretJson(value: unknown): string {
  return encryptSecret(JSON.stringify(value));
}

/** Decrypts an envelope produced by {@link encryptSecretJson}. */
export function decryptSecretJson<T = Record<string, unknown>>(
  envelope: string
): T {
  return JSON.parse(decryptSecret(envelope)) as T;
}

/** Validates a candidate key without throwing — for config diagnostics. */
export function isValidKeyHex(hex: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(hex.trim());
}
