/**
 * WhatsApp channel adapter — WhatsApp Business Cloud API (Meta-hosted).
 *
 * See docs/research/migration-architecture.md §2.1. Requires a Meta Business
 * account, a verified WhatsApp Business number and — for business-initiated
 * messages outside a 24h service window — pre-approved message templates.
 *
 * Config:
 *   secret:   { "accessToken": "EAAB...", "phoneNumberId": "1234567890" }
 *   metadata: { "apiVersion": "v21.0",            // optional, defaults below
 *               "templateName": "...",            // optional: send as template
 *               "templateLanguage": "pt_BR" }     // optional
 *
 * When `templateName` is set the adapter sends a template message (the only
 * way to initiate a conversation); otherwise it sends a plain text message
 * (valid only inside an open 24h service window).
 *
 * When the secret is absent the adapter runs in no-op mode — it logs and
 * returns a soft success so dev environments never crash on a missing token.
 *
 * The transport is injected (defaults to global `fetch`) for unit testing.
 */
import type {
  AdapterConfig,
  ChannelAdapter,
  FetchTransport,
  OutboundMessage,
  SendResult,
} from "../types";

const DEFAULT_API_VERSION = "v21.0";

/** Normalises a phone number to the digits-only form Meta expects. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

interface WhatsAppSecret {
  accessToken: string;
  phoneNumberId: string;
}

/** Builds the Cloud API request body for a plain text message. */
export function buildTextPayload(to: string, body: string): unknown {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body },
  };
}

/** Builds the Cloud API request body for a template message. */
export function buildTemplatePayload(
  to: string,
  templateName: string,
  language: string,
  bodyParam: string
): unknown {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: bodyParam }],
        },
      ],
    },
  };
}

export class WhatsAppAdapter implements ChannelAdapter {
  readonly provider = "whatsapp" as const;
  readonly channel = "whatsapp" as const;

  private readonly secret: WhatsAppSecret | null;
  private readonly apiVersion: string;
  private readonly templateName: string | null;
  private readonly templateLanguage: string;
  private readonly transport: FetchTransport;

  constructor(config: AdapterConfig) {
    const token = config.secret?.accessToken;
    const phoneId = config.secret?.phoneNumberId;
    this.secret =
      typeof token === "string" &&
      token.length > 0 &&
      typeof phoneId === "string" &&
      phoneId.length > 0
        ? { accessToken: token, phoneNumberId: phoneId }
        : null;

    const version = config.metadata?.apiVersion;
    this.apiVersion =
      typeof version === "string" && version.length > 0
        ? version
        : DEFAULT_API_VERSION;

    const template = config.metadata?.templateName;
    this.templateName =
      typeof template === "string" && template.length > 0 ? template : null;

    const lang = config.metadata?.templateLanguage;
    this.templateLanguage =
      typeof lang === "string" && lang.length > 0 ? lang : "pt_BR";

    this.transport =
      config.transport ??
      ((u, init) => fetch(u, init) as ReturnType<FetchTransport>);
  }

  isConfigured(): boolean {
    return this.secret !== null;
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    if (!this.isConfigured()) {
      console.info(
        `[integrations:whatsapp] no-op (unconfigured): ${message.title}`
      );
      return { ok: true, noop: true };
    }

    if (!message.target) {
      return { ok: false, error: "WhatsApp requer um numero de destino" };
    }

    const to = normalizePhone(message.target);
    if (to.length < 8) {
      return { ok: false, error: "Numero de WhatsApp invalido" };
    }

    const secret = this.secret as WhatsAppSecret;
    const url = `https://graph.facebook.com/${this.apiVersion}/${secret.phoneNumberId}/messages`;

    // Compose the human-readable text once; reused for text or template body.
    const text = message.title
      ? `${message.title}\n\n${message.body}`
      : message.body;

    const payload = this.templateName
      ? buildTemplatePayload(
          to,
          this.templateName,
          this.templateLanguage,
          text
        )
      : buildTextPayload(to, text);

    try {
      const res = await this.transport(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret.accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const raw = await res.text().catch(() => "");

      if (!res.ok) {
        return {
          ok: false,
          error: `WhatsApp Cloud API respondeu ${res.status}${
            raw ? `: ${raw}` : ""
          }`,
        };
      }

      // Extract the accepted message id when present.
      let providerRef: string | undefined;
      try {
        const parsed = JSON.parse(raw) as {
          messages?: { id?: string }[];
        };
        providerRef = parsed.messages?.[0]?.id;
      } catch {
        // Non-JSON success body — fine, just no providerRef.
      }

      return { ok: true, providerRef };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error ? err.message : "Falha ao enviar ao WhatsApp",
      };
    }
  }
}
