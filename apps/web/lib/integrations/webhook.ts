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

/** Persisted lifecycle status of a `webhook_events` row. */
export type WebhookEventStatus = "received" | "processed" | "failed" | "skipped";

/**
 * Result of recording an inbound event in the idempotency log.
 *
 *  - `new`        — first time this (provider, externalId) was seen.
 *  - `duplicate`  — already recorded; `status` is the stored row's status, so
 *    the caller can decide whether to re-process (a prior `failed` attempt).
 */
export type RecordResult =
  | { state: "new" }
  | { state: "duplicate"; status: WebhookEventStatus };

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
  /**
   * Resets a previously-`failed` event back to `received` so the handler can
   * run again on a provider redelivery. Called only for a `failed` duplicate.
   */
  resetEvent(input: { provider: string; externalId: string }): Promise<void>;
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
 *   * `signatureOk === false`     -> 401, nothing recorded.
 *   * a duplicate of a SUCCESS    -> 200, handler skipped (true idempotency).
 *   * a duplicate of a FAILURE    -> handler RE-RUNS — a provider redelivery is
 *     the retry path for an event whose prior attempt failed.
 *   * a new event                -> handler runs; recorded `processed`/`failed`.
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

  // Idempotency: an already-seen event id that previously SUCCEEDED (or is
  // still mid-flight) is acknowledged, not re-processed. But a prior `failed`
  // attempt is re-processable — a provider redelivery is its retry path, so
  // reset the row to `received` and fall through to run the handler again.
  if (recorded.state === "duplicate") {
    if (recorded.status !== "failed") {
      return { ok: true, state: "duplicate", status: 200 };
    }
    try {
      await ports.resetEvent({
        provider: parsed.provider,
        externalId: parsed.externalId,
      });
    } catch (err) {
      return {
        ok: false,
        reason: "error",
        status: 500,
        detail: err instanceof Error ? err.message : "reset_failed",
      };
    }
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
