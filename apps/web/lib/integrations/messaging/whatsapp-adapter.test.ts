import { describe, it, expect } from "vitest";
import {
  WhatsAppAdapter,
  normalizePhone,
  buildTextPayload,
  buildTemplatePayload,
} from "./whatsapp-adapter";
import type { FetchTransport } from "../types";

function mockTransport(
  response: { ok: boolean; status: number; body?: string } = {
    ok: true,
    status: 200,
    body: '{"messages":[{"id":"wamid.ABC"}]}',
  }
) {
  const calls: { url: string; body?: string; headers?: Record<string, string> }[] =
    [];
  const transport: FetchTransport = async (url, init) => {
    calls.push({ url, body: init.body, headers: init.headers });
    return {
      ok: response.ok,
      status: response.status,
      text: async () => response.body ?? "",
    };
  };
  return { transport, calls };
}

const SECRET = { accessToken: "EAAB-token", phoneNumberId: "55119999" };

describe("WhatsAppAdapter", () => {
  const message = {
    title: "Alerta",
    body: "Ticket SLA estourado",
    target: "+55 (11) 99999-0000",
  };

  it("normalizePhone strips non-digits", () => {
    expect(normalizePhone("+55 (11) 99999-0000")).toBe("5511999990000");
  });

  it("runs in no-op mode when unconfigured", async () => {
    const { transport, calls } = mockTransport();
    const adapter = new WhatsAppAdapter({
      secret: null,
      metadata: {},
      transport,
    });
    expect(adapter.isConfigured()).toBe(false);
    const result = await adapter.send(message);
    expect(result.ok).toBe(true);
    expect(result.noop).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("requires a target number when configured", async () => {
    const { transport } = mockTransport();
    const adapter = new WhatsAppAdapter({
      secret: SECRET,
      metadata: {},
      transport,
    });
    const result = await adapter.send({ title: "t", body: "b" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("numero");
  });

  it("sends a text message and returns the provider message id", async () => {
    const { transport, calls } = mockTransport();
    const adapter = new WhatsAppAdapter({
      secret: SECRET,
      metadata: {},
      transport,
    });
    const result = await adapter.send(message);
    expect(result.ok).toBe(true);
    expect(result.providerRef).toBe("wamid.ABC");
    expect(calls[0].url).toContain("/55119999/messages");
    expect(calls[0].headers?.Authorization).toBe("Bearer EAAB-token");
    const sent = JSON.parse(calls[0].body as string);
    expect(sent.type).toBe("text");
    expect(sent.to).toBe("5511999990000");
  });

  it("sends a template message when templateName metadata is set", async () => {
    const { transport, calls } = mockTransport();
    const adapter = new WhatsAppAdapter({
      secret: SECRET,
      metadata: { templateName: "alerta_ops", templateLanguage: "pt_BR" },
      transport,
    });
    await adapter.send(message);
    const sent = JSON.parse(calls[0].body as string);
    expect(sent.type).toBe("template");
    expect(sent.template.name).toBe("alerta_ops");
    expect(sent.template.language.code).toBe("pt_BR");
  });

  it("returns an error on a non-2xx response", async () => {
    const { transport } = mockTransport({
      ok: false,
      status: 401,
      body: '{"error":"invalid token"}',
    });
    const adapter = new WhatsAppAdapter({
      secret: SECRET,
      metadata: {},
      transport,
    });
    const result = await adapter.send(message);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("401");
  });

  it("buildTextPayload / buildTemplatePayload shape the Cloud API body", () => {
    expect(buildTextPayload("55119", "hi")).toMatchObject({
      messaging_product: "whatsapp",
      type: "text",
      to: "55119",
    });
    expect(
      buildTemplatePayload("55119", "tpl", "pt_BR", "param")
    ).toMatchObject({ type: "template" });
  });
});
