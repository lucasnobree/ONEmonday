import { describe, it, expect } from "vitest";
import {
  FocusNfeAdapter,
  buildFocusPayload,
  mapFocusStatus,
} from "./focus-nfe-adapter";
import type { FetchTransport, FiscalEmissionRequest } from "../finance-types";

/** A mock transport that records calls and returns a configurable response. */
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

const request: FiscalEmissionRequest = {
  reference: "inv-123",
  docType: "nfse",
  amountCents: 150_000,
  description: "Servico de consultoria",
  customerName: "Cliente LTDA",
  customerTaxId: "12345678000199",
};

describe("mapFocusStatus", () => {
  it("maps the known Focus NFe statuses", () => {
    expect(mapFocusStatus("autorizado")).toBe("authorized");
    expect(mapFocusStatus("cancelado")).toBe("cancelled");
    expect(mapFocusStatus("erro_autorizacao")).toBe("rejected");
    expect(mapFocusStatus("denegado")).toBe("rejected");
    expect(mapFocusStatus("processando_autorizacao")).toBe("processing");
  });

  it("defaults an unknown status to processing", () => {
    expect(mapFocusStatus("algo_novo")).toBe("processing");
    expect(mapFocusStatus(undefined)).toBe("processing");
  });
});

describe("buildFocusPayload", () => {
  it("emits the amount in major units with 2 decimals", () => {
    const payload = buildFocusPayload(request) as {
      valor_total: string;
      valor_servicos: string;
    };
    expect(payload.valor_total).toBe("1500.00");
    expect(payload.valor_servicos).toBe("1500.00");
  });
});

describe("FocusNfeAdapter", () => {
  it("runs in no-op mode when unconfigured (no token)", async () => {
    const { transport, calls } = mockTransport();
    const adapter = new FocusNfeAdapter({
      secret: null,
      metadata: {},
      transport,
    });
    expect(adapter.isConfigured()).toBe(false);

    const result = await adapter.emit(request);
    expect(result.ok).toBe(true);
    expect(result.noop).toBe(true);
    expect(result.status).toBe("processing");
    expect(calls).toHaveLength(0); // never hits the gateway
  });

  it("emits and maps an authorized response", async () => {
    const { transport, calls } = mockTransport({
      ok: true,
      status: 200,
      body: JSON.stringify({
        status: "autorizado",
        ref: "inv-123",
        numero: "42",
        chave_nfe: "3526...",
        caminho_danfe: "/danfe.pdf",
        caminho_xml_nota_fiscal: "/nota.xml",
      }),
    });
    const adapter = new FocusNfeAdapter({
      secret: { token: "tok_live" },
      metadata: {},
      transport,
    });
    expect(adapter.isConfigured()).toBe(true);

    const result = await adapter.emit(request);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("authorized");
    expect(result.protocol).toBe("42");
    expect(result.accessKey).toBe("3526...");
    expect(result.pdfUrl).toBe("/danfe.pdf");
    expect(calls[0].url).toContain("/v2/nfse?ref=inv-123");
  });

  it("reports a rejected document as not ok", async () => {
    const { transport } = mockTransport({
      ok: true,
      status: 200,
      body: JSON.stringify({
        status: "erro_autorizacao",
        mensagem_sefaz: "CNPJ invalido",
      }),
    });
    const adapter = new FocusNfeAdapter({
      secret: { token: "tok" },
      metadata: {},
      transport,
    });
    const result = await adapter.emit(request);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("CNPJ invalido");
  });

  it("returns an error result on an HTTP failure", async () => {
    const { transport } = mockTransport({
      ok: false,
      status: 422,
      body: "invalid",
    });
    const adapter = new FocusNfeAdapter({
      secret: { token: "tok" },
      metadata: {},
      transport,
    });
    const result = await adapter.emit(request);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("error");
    expect(result.reason).toContain("422");
  });

  it("never throws on a transport exception", async () => {
    const transport: FetchTransport = async () => {
      throw new Error("network down");
    };
    const adapter = new FocusNfeAdapter({
      secret: { token: "tok" },
      metadata: {},
      transport,
    });
    const result = await adapter.emit(request);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("error");
    expect(result.reason).toBe("network down");
  });
});
