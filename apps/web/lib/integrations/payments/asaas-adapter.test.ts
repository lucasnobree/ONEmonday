import { describe, it, expect } from "vitest";
import {
  AsaasAdapter,
  buildAsaasPayload,
  mapAsaasStatus,
  toAsaasBillingType,
} from "./asaas-adapter";
import type { ChargeRequest, FetchTransport } from "../finance-types";

function mockTransport(
  response: { ok: boolean; status: number; body?: string } = {
    ok: true,
    status: 200,
  }
) {
  const calls: { url: string; body?: string }[] = [];
  const transport: FetchTransport = async (url, init) => {
    calls.push({ url, body: init.body });
    return {
      ok: response.ok,
      status: response.status,
      text: async () => response.body ?? "",
    };
  };
  return { transport, calls };
}

const request: ChargeRequest = {
  reference: "inv-77",
  billingType: "pix",
  amountCents: 89_900,
  currency: "BRL",
  dueDate: "2026-06-01",
  customerName: "Cliente",
  description: "Fatura INV-77",
};

describe("mapAsaasStatus", () => {
  it("maps the known Asaas statuses", () => {
    expect(mapAsaasStatus("RECEIVED")).toBe("received");
    expect(mapAsaasStatus("CONFIRMED")).toBe("received");
    expect(mapAsaasStatus("OVERDUE")).toBe("overdue");
    expect(mapAsaasStatus("REFUNDED")).toBe("cancelled");
    expect(mapAsaasStatus("PENDING")).toBe("pending");
  });

  it("defaults an unknown status to pending", () => {
    expect(mapAsaasStatus("SOMETHING")).toBe("pending");
  });
});

describe("toAsaasBillingType", () => {
  it("maps billing types to the Asaas enum", () => {
    expect(toAsaasBillingType("pix")).toBe("PIX");
    expect(toAsaasBillingType("boleto")).toBe("BOLETO");
    expect(toAsaasBillingType("undefined")).toBe("UNDEFINED");
  });
});

describe("buildAsaasPayload", () => {
  it("emits the amount in major units and carries the idempotency ref", () => {
    const payload = buildAsaasPayload(request) as {
      value: number;
      externalReference: string;
      billingType: string;
    };
    expect(payload.value).toBe(899);
    expect(payload.externalReference).toBe("inv-77");
    expect(payload.billingType).toBe("PIX");
  });
});

describe("AsaasAdapter", () => {
  it("runs in no-op mode when unconfigured (no API key)", async () => {
    const { transport, calls } = mockTransport();
    const adapter = new AsaasAdapter({
      secret: null,
      metadata: {},
      transport,
    });
    expect(adapter.isConfigured()).toBe(false);

    const result = await adapter.createCharge(request);
    expect(result.ok).toBe(true);
    expect(result.noop).toBe(true);
    expect(result.status).toBe("pending");
    expect(calls).toHaveLength(0);
  });

  it("creates a charge and surfaces the PIX payload", async () => {
    const { transport } = mockTransport({
      ok: true,
      status: 200,
      body: JSON.stringify({
        id: "pay_1",
        status: "PENDING",
        pixCopyAndPaste: "00020126...",
        invoiceUrl: "https://asaas/i/pay_1",
      }),
    });
    const adapter = new AsaasAdapter({
      secret: { apiKey: "key_live" },
      metadata: {},
      transport,
    });
    const result = await adapter.createCharge(request);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("pending");
    expect(result.providerRef).toBe("pay_1");
    expect(result.pixPayload).toBe("00020126...");
    expect(result.invoiceUrl).toBe("https://asaas/i/pay_1");
  });

  it("surfaces a boleto digitable line", async () => {
    const { transport } = mockTransport({
      ok: true,
      status: 200,
      body: JSON.stringify({
        id: "pay_2",
        status: "PENDING",
        identificationField: "34191.79001 ...",
      }),
    });
    const adapter = new AsaasAdapter({
      secret: { apiKey: "key" },
      metadata: {},
      transport,
    });
    const result = await adapter.createCharge({
      ...request,
      billingType: "boleto",
    });
    expect(result.ok).toBe(true);
    expect(result.boletoLine).toBe("34191.79001 ...");
  });

  it("returns an error result on an HTTP failure", async () => {
    const { transport } = mockTransport({ ok: false, status: 400 });
    const adapter = new AsaasAdapter({
      secret: { apiKey: "key" },
      metadata: {},
      transport,
    });
    const result = await adapter.createCharge(request);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("error");
    expect(result.reason).toContain("400");
  });

  it("never throws on a transport exception", async () => {
    const transport: FetchTransport = async () => {
      throw new Error("offline");
    };
    const adapter = new AsaasAdapter({
      secret: { apiKey: "key" },
      metadata: {},
      transport,
    });
    const result = await adapter.createCharge(request);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("error");
    expect(result.reason).toBe("offline");
  });
});
