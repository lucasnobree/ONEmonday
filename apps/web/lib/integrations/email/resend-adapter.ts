/**
 * Resend email adapter — transactional / marketing email sending.
 *
 * Resend is the recommended ESP (docs/research/migration-architecture.md §2.8):
 * lowest friction for a Next.js codebase, one vendor for transactional and
 * marketing email. ONEmonday must not run mail infrastructure — Resend is the
 * sending gateway; ONEmonday owns the composer, the audience and the send
 * ledger.
 *
 * Config:
 *   secret:   { "apiKey": "re_..." }   — the Resend API key (Bearer token)
 *   metadata: { "baseUrl": "https://api.resend.com" }   — optional
 *
 * When the API key is absent the adapter runs in **no-op mode**: it never calls
 * Resend and returns a soft result flagged `noop: true`. There is no real
 * Resend account or verified sending domain in dev, so nothing crashes without
 * one — the caller records the recipient send as `skipped`.
 *
 * To go live the company must supply a Resend account AND a verified sending
 * domain (SPF/DKIM/DMARC DNS records) — deliverability is an operational
 * discipline ONEmonday owns even with an ESP (migration-architecture.md §6).
 *
 * The transport is injected (defaults to global `fetch`) for unit testing.
 */
import type {
  EmailAdapter,
  EmailAdapterConfig,
  EmailMessage,
  EmailSendResult,
  FetchTransport,
} from "../email-types";

const DEFAULT_BASE_URL = "https://api.resend.com";

interface ResendSecret {
  apiKey: string;
}

/** Formats an address as `Name <email>` when a name is present. */
export function formatAddress(email: string, name?: string): string {
  return name && name.length > 0 ? `${name} <${email}>` : email;
}

/** Builds the Resend `POST /emails` request body for one email. */
export function buildResendPayload(message: EmailMessage): unknown {
  const payload: Record<string, unknown> = {
    from: formatAddress(message.from, message.fromName),
    to: [formatAddress(message.to, message.toName)],
    subject: message.subject,
    html: message.html,
  };
  if (message.text && message.text.length > 0) {
    payload.text = message.text;
  }
  if (message.replyTo && message.replyTo.length > 0) {
    payload.reply_to = message.replyTo;
  }
  return payload;
}

export class ResendAdapter implements EmailAdapter {
  readonly provider = "resend" as const;

  private readonly apiKey: string | null;
  private readonly baseUrl: string;
  private readonly transport: FetchTransport;

  constructor(config: EmailAdapterConfig) {
    const key = (config.secret as ResendSecret | null)?.apiKey;
    this.apiKey = typeof key === "string" && key.length > 0 ? key : null;

    const base = config.metadata?.baseUrl;
    this.baseUrl =
      typeof base === "string" && base.length > 0 ? base : DEFAULT_BASE_URL;

    this.transport =
      config.transport ??
      ((u, init) => fetch(u, init) as ReturnType<FetchTransport>);
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.isConfigured()) {
      // No-op / log-only mode — keeps dev environments from crashing. Nothing
      // is sent; the caller records the recipient send as `skipped`.
      console.info(
        `[integrations:resend] no-op (unconfigured): ${message.subject} -> ${message.to}`
      );
      return { ok: true, noop: true };
    }

    if (!message.to || !message.to.includes("@")) {
      return { ok: false, error: "Endereco de destino invalido" };
    }
    if (!message.from || !message.from.includes("@")) {
      return { ok: false, error: "Endereco de remetente invalido" };
    }

    const url = `${this.baseUrl}/emails`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey as string}`,
    };
    // Resend de-duplicates a re-send carrying the same Idempotency-Key.
    if (message.idempotencyKey && message.idempotencyKey.length > 0) {
      headers["Idempotency-Key"] = message.idempotencyKey;
    }

    try {
      const res = await this.transport(url, {
        method: "POST",
        headers,
        body: JSON.stringify(buildResendPayload(message)),
      });

      const raw = await res.text().catch(() => "");
      let body: Record<string, unknown> = {};
      try {
        body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        // Non-JSON body — leave `body` empty.
      }

      if (!res.ok) {
        // Resend errors carry a `message` field; fall back to the raw body.
        const detail =
          typeof body.message === "string" ? body.message : raw;
        return {
          ok: false,
          error: `Resend respondeu ${res.status}${
            detail ? `: ${detail}` : ""
          }`,
        };
      }

      return {
        ok: true,
        providerRef: typeof body.id === "string" ? body.id : undefined,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Falha ao enviar e-mail",
      };
    }
  }
}
