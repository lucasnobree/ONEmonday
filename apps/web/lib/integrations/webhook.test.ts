import { describe, it, expect, vi } from "vitest";
import {
  processWebhook,
  type WebhookPorts,
  type ParsedWebhook,
  type RecordResult,
} from "./webhook";

/** A mock {@link WebhookPorts} with a configurable record result. */
function mockPorts(recordResult: RecordResult | Error) {
  const finalized: { status: string; error?: string }[] = [];
  const reset: { provider: string; externalId: string }[] = [];
  const ports: WebhookPorts = {
    recordEvent: async () => {
      if (recordResult instanceof Error) throw recordResult;
      return recordResult;
    },
    resetEvent: async (input) => {
      reset.push(input);
    },
    finalizeEvent: async (input) => {
      finalized.push({ status: input.status, error: input.error });
    },
  };
  return { ports, finalized, reset };
}

const baseEvent: ParsedWebhook = {
  provider: "whatsapp",
  externalId: "wamid.ABC",
  eventType: "status",
  payload: { entry: [] },
  signatureOk: true,
};

describe("processWebhook", () => {
  it("rejects an invalid signature with 401, recording nothing", async () => {
    const { ports } = mockPorts({ state: "new" });
    const recordSpy = vi.spyOn(ports, "recordEvent");
    const outcome = await processWebhook(
      { ...baseEvent, signatureOk: false },
      ports,
      async () => {}
    );
    expect(outcome).toMatchObject({ ok: false, status: 401 });
    expect(recordSpy).not.toHaveBeenCalled();
  });

  it("rejects a missing external id with 400", async () => {
    const { ports } = mockPorts({ state: "new" });
    const outcome = await processWebhook(
      { ...baseEvent, externalId: "" },
      ports,
      async () => {}
    );
    expect(outcome).toMatchObject({ ok: false, status: 400 });
  });

  it("processes a new event and finalizes it as processed", async () => {
    const { ports, finalized } = mockPorts({ state: "new" });
    const handler = vi.fn().mockResolvedValue(undefined);
    const outcome = await processWebhook(baseEvent, ports, handler);
    expect(outcome).toMatchObject({ ok: true, state: "processed" });
    expect(handler).toHaveBeenCalledOnce();
    expect(finalized[0].status).toBe("processed");
  });

  it("is idempotent: a duplicate of a PROCESSED event is acknowledged, handler skipped", async () => {
    const { ports } = mockPorts({ state: "duplicate", status: "processed" });
    const handler = vi.fn().mockResolvedValue(undefined);
    const outcome = await processWebhook(baseEvent, ports, handler);
    expect(outcome).toMatchObject({ ok: true, state: "duplicate", status: 200 });
    // Idempotency: the domain handler must NOT run on a replay.
    expect(handler).not.toHaveBeenCalled();
  });

  it("skips the handler for a duplicate still in the `received` state", async () => {
    const { ports } = mockPorts({ state: "duplicate", status: "received" });
    const handler = vi.fn().mockResolvedValue(undefined);
    const outcome = await processWebhook(baseEvent, ports, handler);
    expect(outcome).toMatchObject({ ok: true, state: "duplicate" });
    expect(handler).not.toHaveBeenCalled();
  });

  // Regression — Integration S1: a redelivery of an event whose stored status
  // is `failed` must RE-PROCESS — a provider redelivery is the retry path.
  it("re-processes a duplicate whose stored status is `failed`", async () => {
    const { ports, finalized, reset } = mockPorts({
      state: "duplicate",
      status: "failed",
    });
    const handler = vi.fn().mockResolvedValue(undefined);
    const outcome = await processWebhook(baseEvent, ports, handler);
    expect(outcome).toMatchObject({ ok: true, state: "processed" });
    // The failed row was reset to `received`, then the handler ran again.
    expect(reset).toEqual([
      { provider: baseEvent.provider, externalId: baseEvent.externalId },
    ]);
    expect(handler).toHaveBeenCalledOnce();
    expect(finalized[0].status).toBe("processed");
  });

  it("returns 500 when resetting a failed duplicate itself fails", async () => {
    const { ports } = mockPorts({ state: "duplicate", status: "failed" });
    ports.resetEvent = async () => {
      throw new Error("reset db error");
    };
    const handler = vi.fn().mockResolvedValue(undefined);
    const outcome = await processWebhook(baseEvent, ports, handler);
    expect(outcome).toMatchObject({ ok: false, status: 500 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("marks the event failed and returns 500 when the handler throws", async () => {
    const { ports, finalized } = mockPorts({ state: "new" });
    const handler = vi.fn().mockRejectedValue(new Error("boom"));
    const outcome = await processWebhook(baseEvent, ports, handler);
    expect(outcome).toMatchObject({ ok: false, status: 500 });
    expect(finalized[0].status).toBe("failed");
    expect(finalized[0].error).toContain("boom");
  });

  it("returns 500 when recording the event itself fails", async () => {
    const { ports } = mockPorts(new Error("db down"));
    const outcome = await processWebhook(baseEvent, ports, async () => {});
    expect(outcome).toMatchObject({ ok: false, status: 500 });
  });
});
