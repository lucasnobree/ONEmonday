import { describe, it, expect, vi } from "vitest";
import {
  ResendAdapter,
  buildResendPayload,
  formatAddress,
} from "./resend-adapter";
import type { FetchTransport } from "../email-types";

/** A mock transport that records calls and returns a configurable response. */
function mockTransport(
  response: { ok: boolean; status: number; body?: string } = {
    ok: true,
    status: 200,
    body: JSON.stringify({ id: "msg_123" }),
  }
) {
  const calls: { url: string; headers?: Record<string, string>; body?: string }[] =
    [];
  const transport: FetchTransport = async (url, init) => {
    calls.push({ url, headers: init.headers, body: init.body });
    return {
      ok: response.ok,
      status: response.status,
      text: async () => response.body ?? "",
    };
  };
  return { transport, calls };
}

const message = {
  to: "lead@example.com",
  toName: "Lead Example",
  from: "marketing@onemonday.test",
  fromName: "ONEmonday",
  subject: "Novidades de maio",
  html: "<p>Olá!</p>",
  text: "Olá!",
  idempotencyKey: "ec-1-lead@example.com",
};

describe("ResendAdapter", () => {
  it("runs in no-op mode when unconfigured (no API key)", async () => {
    const { transport, calls } = mockTransport();
    const adapter = new ResendAdapter({
      secret: null,
      metadata: {},
      transport,
    });
    expect(adapter.isConfigured()).toBe(false);

    const result = await adapter.send(message);
    expect(result.ok).toBe(true);
    expect(result.noop).toBe(true);
    expect(calls).toHaveLength(0); // never hit the transport
  });

  it("treats an empty-string API key as unconfigured", async () => {
    const adapter = new ResendAdapter({
      secret: { apiKey: "" },
      metadata: {},
    });
    expect(adapter.isConfigured()).toBe(false);
  });

  it("posts an email to the Resend API when configured", async () => {
    const { transport, calls } = mockTransport();
    const adapter = new ResendAdapter({
      secret: { apiKey: "re_test_key" },
      metadata: {},
      transport,
    });
    expect(adapter.isConfigured()).toBe(true);

    const result = await adapter.send(message);
    expect(result.ok).toBe(true);
    expect(result.noop).toBeUndefined();
    expect(result.providerRef).toBe("msg_123");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].headers?.Authorization).toBe("Bearer re_test_key");
    // The idempotency key is forwarded so a retry never double-sends.
    expect(calls[0].headers?.["Idempotency-Key"]).toBe(
      "ec-1-lead@example.com"
    );
    const sent = JSON.parse(calls[0].body as string);
    expect(sent.subject).toBe("Novidades de maio");
    expect(sent.to).toEqual(["Lead Example <lead@example.com>"]);
  });

  it("honours a custom baseUrl from metadata", async () => {
    const { transport, calls } = mockTransport();
    const adapter = new ResendAdapter({
      secret: { apiKey: "re_test_key" },
      metadata: { baseUrl: "https://esp.internal" },
      transport,
    });
    await adapter.send(message);
    expect(calls[0].url).toBe("https://esp.internal/emails");
  });

  it("rejects an invalid recipient address without hitting the transport", async () => {
    const { transport, calls } = mockTransport();
    const adapter = new ResendAdapter({
      secret: { apiKey: "re_test_key" },
      metadata: {},
      transport,
    });
    const result = await adapter.send({ ...message, to: "not-an-email" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("destino");
    expect(calls).toHaveLength(0);
  });

  it("returns an error result on a non-2xx response", async () => {
    const { transport } = mockTransport({
      ok: false,
      status: 422,
      body: JSON.stringify({ message: "domain not verified" }),
    });
    const adapter = new ResendAdapter({
      secret: { apiKey: "re_test_key" },
      metadata: {},
      transport,
    });
    const result = await adapter.send(message);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("422");
    expect(result.error).toContain("domain not verified");
  });

  it("returns an error result when the transport throws", async () => {
    const transport: FetchTransport = vi
      .fn()
      .mockRejectedValue(new Error("network down"));
    const adapter = new ResendAdapter({
      secret: { apiKey: "re_test_key" },
      metadata: {},
      transport,
    });
    const result = await adapter.send(message);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("network down");
  });

  it("formatAddress wraps a name only when one is present", () => {
    expect(formatAddress("a@b.com", "Alice")).toBe("Alice <a@b.com>");
    expect(formatAddress("a@b.com")).toBe("a@b.com");
    expect(formatAddress("a@b.com", "")).toBe("a@b.com");
  });

  it("buildResendPayload omits text/reply_to when absent", () => {
    const payload = buildResendPayload({
      to: "a@b.com",
      from: "c@d.com",
      subject: "S",
      html: "<p>H</p>",
    }) as Record<string, unknown>;
    expect(payload.text).toBeUndefined();
    expect(payload.reply_to).toBeUndefined();
    expect(payload.html).toBe("<p>H</p>");
  });
});
