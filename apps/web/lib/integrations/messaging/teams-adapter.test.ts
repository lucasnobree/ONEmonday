import { describe, it, expect, vi } from "vitest";
import { TeamsAdapter, buildTeamsCard } from "./teams-adapter";
import type { FetchTransport } from "../types";

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

describe("TeamsAdapter", () => {
  const message = {
    title: "Card atrasado",
    body: "O card X passou do prazo",
    url: "https://app/cards/1",
  };

  it("runs in no-op mode when unconfigured (no webhook URL)", async () => {
    const { transport, calls } = mockTransport();
    const adapter = new TeamsAdapter({ secret: null, metadata: {}, transport });
    expect(adapter.isConfigured()).toBe(false);

    const result = await adapter.send(message);
    expect(result.ok).toBe(true);
    expect(result.noop).toBe(true);
    expect(calls).toHaveLength(0); // never hit the transport
  });

  it("posts an Adaptive Card to the configured webhook URL", async () => {
    const { transport, calls } = mockTransport();
    const adapter = new TeamsAdapter({
      secret: { webhookUrl: "https://workflow.example/hook" },
      metadata: {},
      transport,
    });
    expect(adapter.isConfigured()).toBe(true);

    const result = await adapter.send(message);
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://workflow.example/hook");
    const sent = JSON.parse(calls[0].body as string);
    expect(sent.type).toBe("message");
    expect(sent.attachments[0].contentType).toContain("adaptive");
  });

  it("returns an error result on a non-2xx response", async () => {
    const { transport } = mockTransport({
      ok: false,
      status: 400,
      body: "Bad payload",
    });
    const adapter = new TeamsAdapter({
      secret: { webhookUrl: "https://workflow.example/hook" },
      metadata: {},
      transport,
    });
    const result = await adapter.send(message);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("400");
  });

  it("returns an error result when the transport throws", async () => {
    const transport: FetchTransport = vi
      .fn()
      .mockRejectedValue(new Error("network down"));
    const adapter = new TeamsAdapter({
      secret: { webhookUrl: "https://workflow.example/hook" },
      metadata: {},
      transport,
    });
    const result = await adapter.send(message);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("network down");
  });

  it("buildTeamsCard includes an action only when a url is present", () => {
    const withUrl = buildTeamsCard(message) as {
      attachments: { content: { actions?: unknown[] } }[];
    };
    expect(withUrl.attachments[0].content.actions).toHaveLength(1);

    const noUrl = buildTeamsCard({ title: "t", body: "b" }) as {
      attachments: { content: { actions?: unknown[] } }[];
    };
    expect(noUrl.attachments[0].content.actions).toBeUndefined();
  });
});
