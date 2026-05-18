/**
 * Integration-layer contracts for Phase 5 — the email-sending capability
 * (docs/research/migration-architecture.md §2.8 "RD Station Marketing —
 * gateway sending").
 *
 * Phase 1 (`types.ts`) defined the messaging contracts; Phase 4
 * (`finance-types.ts`) added fiscal / banking / payment. Phase 5 extends the
 * same provider-adapter pattern with an `EmailAdapter` so ONEmonday can send
 * transactional and marketing email through an ESP — it never runs mail
 * infrastructure itself.
 *
 * Every email adapter:
 *   * takes an injected {@link FetchTransport} so it is fully unit-testable;
 *   * runs in a safe no-op mode when unconfigured — there is no real ESP
 *     account / API key / verified sending domain in dev, and nothing may
 *     crash without them. A no-op call returns a soft result flagged
 *     `noop: true`.
 *
 * Email deliverability (SPF/DKIM/DMARC, warm-up, bounce/complaint suppression,
 * LGPD opt-in) is an operational discipline the company owns even with an ESP
 * (migration-architecture.md §6).
 */
import type { AdapterConfig } from "./types";

export type { AdapterConfig, FetchTransport } from "./types";

/** A single outbound email — provider-agnostic. */
export interface EmailMessage {
  /** Recipient address. */
  to: string;
  /** Optional recipient display name. */
  toName?: string;
  /** Sender address — must be on a domain verified with the ESP. */
  from: string;
  /** Optional sender display name. */
  fromName?: string;
  /** Optional reply-to address. */
  replyTo?: string;
  subject: string;
  /** HTML body rendered to the recipient. */
  html: string;
  /** Plain-text fallback body. */
  text?: string;
  /**
   * Idempotency key — the same key never double-sends at the ESP. Used as the
   * Resend `Idempotency-Key` header.
   */
  idempotencyKey?: string;
}

/** Outcome of an email send — never throws for expected failures. */
export interface EmailSendResult {
  /** True when the ESP accepted the email (or no-op mode absorbed it). */
  ok: boolean;
  /** ESP-side message id, when one was returned. */
  providerRef?: string;
  /** Human-readable failure reason when `ok` is false. */
  error?: string;
  /**
   * True when the adapter ran in no-op / log-only mode because it holds no
   * real credentials. The caller treats this as "nothing was sent" and records
   * the recipient send as `skipped`.
   */
  noop?: boolean;
}

/** The contract every email (ESP) provider implements. */
export interface EmailAdapter {
  /** Provider slug — unique across the email registry. */
  readonly provider: string;
  /** True when the adapter holds real credentials and can actually send. */
  isConfigured(): boolean;
  /** Sends one email. Resolves to an {@link EmailSendResult}; never throws. */
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/** Re-export so email adapter modules import a single config shape. */
export type EmailAdapterConfig = AdapterConfig;
