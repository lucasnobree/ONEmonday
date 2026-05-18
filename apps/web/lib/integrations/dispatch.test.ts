import { describe, it, expect, vi } from "vitest";
import {
  dispatchOutboxRow,
  dispatchBatch,
  toOutboundMessage,
  MAX_ATTEMPTS,
  type OutboxRow,
  type DispatchPorts,
  type ResolvedCredential,
} from "./dispatch";

/** Builds a pending Teams outbox row. */
function teamsRow(overrides: Partial<OutboxRow> = {}): OutboxRow {
  return {
    id: "row-1",
    sectorId: "sector-1",
    channel: "teams",
    target: null,
    eventType: "card_overdue",
    payload: { title: "Atrasado", body: "Card X" },
    attempts: 0,
    ...overrides,
  };
}

/** A mock {@link DispatchPorts} with configurable credential + a spy. */
function mockPorts(credential: ResolvedCredential | null): {
  ports: DispatchPorts;
  marks: { id: string; update: Record<string, unknown> }[];
} {
  const marks: { id: string; update: Record<string, unknown> }[] = [];
  const ports: DispatchPorts = {
    loadCredential: async () => credential,
    markOutbox: async (id, update) => {
      marks.push({ id, update });
    },
  };
  return { ports, marks };
}

describe("dispatch logic", () => {
  it("maps an outbox row to an OutboundMessage", () => {
    const msg = toOutboundMessage(
      teamsRow({ payload: { title: "T", body: "B", url: "u" } })
    );
    expect(msg).toMatchObject({ title: "T", body: "B", url: "u" });
  });

  it("sends through the adapter and marks the row sent", async () => {
    // A configured Teams credential — but with a mock-free adapter we still
    // need a real webhook URL; use no-op mode by passing an empty secret so
    // the adapter soft-succeeds without a transport.
    const { ports, marks } = mockPorts({ secret: null, metadata: {} });
    const outcome = await dispatchOutboxRow(teamsRow(), ports);
    expect(outcome.status).toBe("sent");
    expect(marks[0].update.status).toBe("sent");
    expect(marks[0].update.attempts).toBe(1);
  });

  it("treats a missing credential as a soft no-op success", async () => {
    const { ports, marks } = mockPorts(null);
    const outcome = await dispatchOutboxRow(teamsRow(), ports);
    expect(outcome.status).toBe("sent");
    expect(outcome.result.noop).toBe(true);
    expect(marks[0].update.error).toContain("nao configurado");
  });

  it("marks an in_app row sent without external dispatch", async () => {
    const { ports } = mockPorts(null);
    const loadSpy = vi.spyOn(ports, "loadCredential");
    const outcome = await dispatchOutboxRow(
      teamsRow({ channel: "in_app" }),
      ports
    );
    expect(outcome.status).toBe("sent");
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it("leaves a row pending for retry when the adapter fails below max attempts", async () => {
    // A Teams credential with a webhook URL but a transport that fails would
    // be needed for a real failure; instead simulate via a credential whose
    // metadata triggers the WhatsApp 'missing target' error path.
    const { ports, marks } = mockPorts({
      secret: { accessToken: "t", phoneNumberId: "p" },
      metadata: {},
    });
    // whatsapp row with no target -> adapter returns ok:false.
    const outcome = await dispatchOutboxRow(
      teamsRow({ channel: "whatsapp", target: null, attempts: 0 }),
      ports
    );
    expect(outcome.status).toBe("pending");
    expect(marks[0].update.status).toBe("pending");
    expect(marks[0].update.attempts).toBe(1);
  });

  it("marks a row failed once attempts reach the max", async () => {
    const { ports, marks } = mockPorts({
      secret: { accessToken: "t", phoneNumberId: "p" },
      metadata: {},
    });
    const outcome = await dispatchOutboxRow(
      teamsRow({
        channel: "whatsapp",
        target: null,
        attempts: MAX_ATTEMPTS - 1,
      }),
      ports
    );
    expect(outcome.status).toBe("failed");
    expect(marks[0].update.status).toBe("failed");
    expect(marks[0].update.attempts).toBe(MAX_ATTEMPTS);
  });

  it("dispatchBatch processes every row and returns one outcome each", async () => {
    const { ports } = mockPorts(null);
    const outcomes = await dispatchBatch(
      [teamsRow({ id: "a" }), teamsRow({ id: "b" })],
      ports
    );
    expect(outcomes.map((o) => o.id)).toEqual(["a", "b"]);
    expect(outcomes.every((o) => o.status === "sent")).toBe(true);
  });
});
