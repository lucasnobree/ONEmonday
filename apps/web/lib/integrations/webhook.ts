/**
 * Inbound-webhook processing logic.
 *
 * Every inbound webhook (Teams / WhatsApp now; fiscal / banking / payment
 * gateways in later phases) follows the same pipeline
 * (docs/research/migration-architecture.md §1.2c):
 *
 *   1. Verify the provider signature over the raw body.
 *   2. Record the raw payload in `webhook_events` keyed by the provider's
 *      event id — idempotency. A redelivery of an already-seen id is
 *      `skipped` without re-processing.
 *   3. Hand the verified, first-seen event to a domain handler.
 *
 * This module is DB-agnostic — it works against the {@link WebhookPorts}
 * interface so it is fully unit-testable. The route handlers supply the
 * service-role-backed implementation.
 */

/** Result of recording an inbound event in the idempotency log. */
export type RecordResult =
  | { state: "new" }
  | { state: "duplicate" };

/** Side-effecting dependencies for webhook processing. */
export interface WebhookPorts {
  /**
   * Inserts a `webhook_events` row. Returns `duplicate` when the
   * (provider, externalId) pair already exists — the idempotency check.
   */
  recordEvent(input: {
    provider: string;
    externalId: string;
    eventType: string | null;
    payload: unknown;
    signatureOk: boolean;
  }): Promise<RecordResult>;
  /** Marks a previously-recorded event as processed / failed. */
  finalizeEvent(input: {
    provider: string;
    externalId: string;
    status: "processed" | "failed";
    error?: string;
  }): Promise<void>;
}

/** Outcome of {@link processWebhook}, mapped to an HTTP status by the route. */
export type WebhookOutcome =
  | { ok: true; state: "processed" | "duplicate"; status: 200 }
  | { ok: false; reason: "invalid_signature"; status: 401 }
  | { ok: false; reason: "bad_request"; status: 400 }
  | { ok: false; reason: "error"; status: 500; detail: string };

/** A parsed, verified inbound webhook ready for the idempotency pipeline. */
export interface ParsedWebhook {
  provider: string;
  /** The provider's own event id — the idempotency key. */
  externalId: string;
  eventType: string | null;
  payload: unknown;
  /** Result of the signature check performed by the route. */
  signatureOk: boolean;
}

/**
 * Runs the verify-record-handle pipeline for a parsed webhook.
 *
 *   * `signatureOk === false` -> 401, nothing recorded.
 *   * a duplicate event id     -> 200, recorded as `skipped`, handler skipped.
 *   * a new event              -> handler runs; recorded `processed`/`failed`.
 *
 * `handle` performs the domain side effect (update a delivery status, log an
 * inbound WhatsApp reply, ...). It may be a no-op for Phase 1.
 */
export async function processWebhook(
  parsed: ParsedWebhook,
  ports: WebhookPorts,
  handle: (parsed: ParsedWebhook) => Promise<void>
): Promise<WebhookOutcome> {
  if (!parsed.signatureOk) {
    return { ok: false, reason: "invalid_signature", status: 401 };
  }
  if (!parsed.externalId) {
    return { ok: false, reason: "bad_request", status: 400 };
  }

  let recorded: RecordResult;
  try {
    recorded = await ports.recordEvent({
      provider: parsed.provider,
      externalId: parsed.externalId,
      eventType: parsed.eventType,
      payload: parsed.payload,
      signatureOk: parsed.signatureOk,
    });
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      status: 500,
      detail: err instanceof Error ? err.message : "record_failed",
    };
  }

  // Idempotency: an already-seen event id is acknowledged, not re-processed.
  if (recorded.state === "duplicate") {
    return { ok: true, state: "duplicate", status: 200 };
  }

  try {
    await handle(parsed);
    await ports.finalizeEvent({
      provider: parsed.provider,
      externalId: parsed.externalId,
      status: "processed",
    });
    return { ok: true, state: "processed", status: 200 };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "handler_failed";
    await ports.finalizeEvent({
      provider: parsed.provider,
      externalId: parsed.externalId,
      status: "failed",
      error: detail,
    });
    return { ok: false, reason: "error", status: 500, detail };
  }
}
