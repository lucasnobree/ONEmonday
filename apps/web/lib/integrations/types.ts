/**
 * Integration-layer contracts — Phase 1 of the total-migration roadmap.
 *
 * The provider-adapter pattern: every outbound capability is defined as a
 * TypeScript interface and each gateway is one implementation. The rest of the
 * app depends on the interface, never on the vendor. Phase 1 ships the
 * `messaging` capability (Microsoft Teams + WhatsApp); later phases add
 * fiscal / banking / payment / email adapters against the same shape.
 */

/** Channels with a Phase-1 outbound adapter. `in_app` is the existing path. */
export type IntegrationChannel = "teams" | "whatsapp" | "in_app";

/** Provider slugs — each maps to exactly one registered adapter. */
export type ProviderSlug = "teams" | "whatsapp";

/**
 * A channel-agnostic outbound message. Adapters translate this into their
 * provider's wire format (an Adaptive Card for Teams, a text/template message
 * for WhatsApp Cloud API).
 */
export interface OutboundMessage {
  /** Short headline — Teams card title; ignored by plain WhatsApp text. */
  title: string;
  /** Body text — the main content on every channel. */
  body: string;
  /**
   * Channel-specific target. WhatsApp: an E.164 phone number (required).
   * Teams: unused (the webhook URL already targets a channel).
   */
  target?: string;
  /** Optional deep link surfaced by channels that support actions. */
  url?: string;
  /** The originating event type, for traceability. */
  eventType?: string;
}

/** Outcome of an adapter `send` call — never throws for expected failures. */
export interface SendResult {
  /** True when the provider accepted the message (or no-op mode absorbed it). */
  ok: boolean;
  /** Provider-side message id, when one is returned. */
  providerRef?: string;
  /** Human-readable failure reason when `ok` is false. */
  error?: string;
  /**
   * True when the adapter ran in no-op / log-only mode because it was not
   * configured with real credentials. The caller treats this as a soft
   * success so dev environments never crash on a missing secret.
   */
  noop?: boolean;
}

/**
 * Minimal transport injected into adapters — a subset of the `fetch` contract.
 * Injecting it makes every adapter fully unit-testable with a mock.
 */
export type FetchTransport = (
  url: string,
  init: {
    method: string;
    headers?: Record<string, string>;
    body?: string;
  }
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

/**
 * Configuration handed to an adapter at construction time. `secret` is the
 * already-decrypted secret blob; `metadata` is the non-secret config. When
 * `secret` is null/empty the adapter runs in no-op mode.
 */
export interface AdapterConfig {
  /** Decrypted secret payload, or null when the channel is unconfigured. */
  secret: Record<string, unknown> | null;
  /** Non-secret provider config (display name, base URLs, template ids). */
  metadata: Record<string, unknown>;
  /** Transport — defaults to global `fetch`; injected as a mock in tests. */
  transport?: FetchTransport;
}

/**
 * The contract every messaging provider implements. New providers (email,
 * fiscal, ...) follow this same shape with their own capability interface.
 */
export interface ChannelAdapter {
  /** Provider slug — unique across the registry. */
  readonly provider: ProviderSlug;
  /** The channel this adapter delivers on. */
  readonly channel: IntegrationChannel;
  /** True when the adapter holds real credentials and can actually send. */
  isConfigured(): boolean;
  /** Delivers a message. Resolves to a {@link SendResult}; never throws. */
  send(message: OutboundMessage): Promise<SendResult>;
}
