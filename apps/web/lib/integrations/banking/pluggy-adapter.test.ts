import { describe, it, expect } from "vitest";
import {
  PluggyAdapter,
  normalizePluggyTransaction,
} from "./pluggy-adapter";
import type { FetchTransport } from "../finance-types";

function mockTransport(
  response: { ok: boolean; status: number; body?: string } = {
    ok: true,
    status: 200,
  }
) {
  const calls: { url: string }[] = [];
  const transport: FetchTransport = async (url) => {
    calls.push({ url });
    return {
      ok: response.ok,
      status: response.status,
      text: async () => response.body ?? "",
    };
  };
  return { transport, calls };
}

describe("normalizePluggyTransaction", () => {
  it("splits a negative amount into a positive debit", () => {
    const tx = normalizePluggyTransaction({
      id: "t1",
      amount: -125.5,
      date: "2026-05-10T00:00:00Z",
      description: "Pagamento fornecedor",
    });
    expect(tx).toEqual({
      externalId: "t1",
      direction: "debit",
      amountCents: 12_550,
      currency: "BRL",
      postedDate: "2026-05-10",
      description: "Pagamento fornecedor",
    });
  });

  it("treats a positive amount as a credit", () => {
    const tx = normalizePluggyTransaction({
      id: "t2",
      amount: 300,
      date: "2026-05-11",
    });
    expect(tx?.direction).toBe("credit");
    expect(tx?.amountCents).toBe(30_000);
  });

  it("returns null for an unusable row", () => {
    expect(normalizePluggyTransaction({ amount: 10 })).toBeNull();
    expect(normalizePluggyTransaction({ id: "t3" })).toBeNull();
    expect(
      normalizePluggyTransaction({ id: "t4", amount: 0 })
    ).toBeNull();
  });
});

describe("PluggyAdapter", () => {
  it("runs in no-op mode when unconfigured (no API key)", async () => {
    const { transport, calls } = mockTransport();
    const adapter = new PluggyAdapter({
      secret: null,
      metadata: {},
      transport,
    });
    expect(adapter.isConfigured()).toBe(false);

    const result = await adapter.fetchTransactions("acc1", "2026-05-01", "2026-05-31");
    expect(result.ok).toBe(true);
    expect(result.noop).toBe(true);
    expect(result.transactions).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("fetches and normalises transactions", async () => {
    const { transport, calls } = mockTransport({
      ok: true,
      status: 200,
      body: JSON.stringify({
        results: [
          { id: "a", amount: 100, date: "2026-05-02", description: "in" },
          { id: "b", amount: -40, date: "2026-05-03", description: "out" },
          { amount: 5 }, // unusable — dropped
        ],
      }),
    });
    const adapter = new PluggyAdapter({
      secret: { apiKey: "key_live" },
      metadata: {},
      transport,
    });
    const result = await adapter.fetchTransactions("acc1", "2026-05-01", "2026-05-31");
    expect(result.ok).toBe(true);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].direction).toBe("credit");
    expect(result.transactions[1].direction).toBe("debit");
    expect(calls[0].url).toContain("accountId=acc1");
  });

  it("returns an error result on an HTTP failure", async () => {
    const { transport } = mockTransport({ ok: false, status: 500 });
    const adapter = new PluggyAdapter({
      secret: { apiKey: "key" },
      metadata: {},
      transport,
    });
    const result = await adapter.fetchTransactions("acc1", "2026-05-01", "2026-05-31");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("500");
  });

  it("never throws on a transport exception", async () => {
    const transport: FetchTransport = async () => {
      throw new Error("timeout");
    };
    const adapter = new PluggyAdapter({
      secret: { apiKey: "key" },
      metadata: {},
      transport,
    });
    const result = await adapter.fetchTransactions("acc1", "2026-05-01", "2026-05-31");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("timeout");
  });
});
