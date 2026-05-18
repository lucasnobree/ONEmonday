/**
 * Microsoft Teams channel adapter.
 *
 * The classic Office 365 connector / Incoming Webhook is being retired
 * (connectors disabled 18-22 May 2026). The supported replacement is a
 * **Workflows (Power Automate) webhook**: a channel owner creates a Workflow
 * with an HTTP trigger and ONEmonday POSTs an Adaptive Card payload to the
 * generated URL. See docs/research/migration-architecture.md §2.1.
 *
 * Config — `secret`: { "webhookUrl": "https://..." }. When absent the adapter
 * runs in no-op mode: it logs and returns a soft success so dev environments
 * with no real Workflow URL never crash.
 *
 * The transport is injected (defaults to global `fetch`) so the adapter is
 * fully unit-testable with a mock.
 */
import type {
  AdapterConfig,
  ChannelAdapter,
  FetchTransport,
  OutboundMessage,
  SendResult,
} from "../types";

/** Builds an Adaptive Card payload accepted by a Teams Workflow webhook. */
export function buildTeamsCard(message: OutboundMessage): unknown {
  const bodyBlocks: unknown[] = [
    {
      type: "TextBlock",
      text: message.title,
      weight: "Bolder",
      size: "Medium",
      wrap: true,
    },
    {
      type: "TextBlock",
      text: message.body,
      wrap: true,
    },
  ];

  const actions: unknown[] = [];
  if (message.url) {
    actions.push({
      type: "Action.OpenUrl",
      title: "Abrir no ONEmonday",
      url: message.url,
    });
  }

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: bodyBlocks,
          ...(actions.length > 0 ? { actions } : {}),
        },
      },
    ],
  };
}

export class TeamsAdapter implements ChannelAdapter {
  readonly provider = "teams" as const;
  readonly channel = "teams" as const;

  private readonly webhookUrl: string | null;
  private readonly transport: FetchTransport;

  constructor(config: AdapterConfig) {
    const url = config.secret?.webhookUrl;
    this.webhookUrl = typeof url === "string" && url.length > 0 ? url : null;
    this.transport =
      config.transport ??
      ((u, init) => fetch(u, init) as ReturnType<FetchTransport>);
  }

  isConfigured(): boolean {
    return this.webhookUrl !== null;
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    if (!this.isConfigured()) {
      // No-op / log-only mode — keeps dev environments from crashing.
      console.info(
        `[integrations:teams] no-op (unconfigured): ${message.title}`
      );
      return { ok: true, noop: true };
    }

    try {
      const res = await this.transport(this.webhookUrl as string, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildTeamsCard(message)),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return {
          ok: false,
          error: `Teams webhook respondeu ${res.status}${
            detail ? `: ${detail}` : ""
          }`,
        };
      }

      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Falha ao enviar ao Teams",
      };
    }
  }
}
