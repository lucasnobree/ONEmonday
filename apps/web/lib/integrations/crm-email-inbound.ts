/**
 * Inbound email -> `crm_activities` fan-out.
 *
 * The `/api/webhooks/email` route receives the Resend inbound-email webhook
 * (an `inbound.email.received`-style event). A received email from a known
 * contact is logged onto the CRM timeline so the deal shows the full
 * conversation alongside WhatsApp — the RD Station CRM "email logging"
 * replacement (docs/research/migration-architecture.md §2.7/§2.8).
 *
 * This is webhook-based inbound logging, NOT a full IMAP two-way mailbox sync:
 * it records emails the ESP forwards to the webhook, it does not poll a
 * mailbox. A complete IMAP sync is deliberately out of scope.
 *
 * The route runs with the service-role client (no user session), so scoping is
 * enforced in code, not RLS: a received email is only logged when its sender
 * address matches a known `crm_contacts` row — that contact's sector and any
 * open deal anchor the activity. An unknown sender is skipped (not an error)
 * so spam / wrong-address mail never creates orphan rows.
 *
 * `parseInboundEmail` is pure and DB-agnostic, so it is fully unit-testable;
 * `logInboundEmail` supplies the service-role-backed side effects.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** A single inbound email extracted from a Resend webhook body. */
export interface InboundEmail {
  /** Provider message id — the idempotency key (`external_ref`). */
  externalId: string;
  /** Sender address, lower-cased and trimmed. */
  from: string;
  /** Subject line; falls back to a placeholder when absent. */
  subject: string;
  /** Plain-text body; HTML is stripped to text when only HTML is present. */
  text: string;
  /** Provider timestamp as ISO, or null when absent. */
  occurredAt: string | null;
}

/**
 * Extracts the bare address from an RFC-5322 `From` value. Resend may deliver
 * the sender either as a plain address or as `Name <addr@host>`; this returns
 * the lower-cased address part in both cases. Returns null when no `@` is
 * present.
 */
export function extractAddress(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  // Prefer the `<...>` angle-bracket form when present.
  const angle = value.match(/<([^>]+)>/);
  const candidate = (angle ? angle[1] : value).trim().toLowerCase();
  return candidate.includes("@") ? candidate : null;
}

/** Collapses HTML to readable plain text — a coarse fallback, not a renderer. */
function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|tr|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Parses the Resend inbound-email webhook body into an {@link InboundEmail}.
 *
 * Resend wraps the event under `{ type, data: {...} }`. The inbound payload
 * carries `email_id` (or `id`), `from`, `subject`, `text` / `html` and
 * `created_at`. Returns null when the body is not a usable inbound email
 * (a non-inbound event, a missing id, or no resolvable sender) — the caller
 * treats that as "nothing to log", not an error.
 */
export function parseInboundEmail(body: unknown): InboundEmail | null {
  if (typeof body !== "object" || body === null) return null;
  const root = body as Record<string, unknown>;

  // Resend events are `{ type: "...", data: {...} }`; tolerate a flat body too.
  const data =
    typeof root.data === "object" && root.data !== null
      ? (root.data as Record<string, unknown>)
      : root;

  const externalId =
    (typeof data.email_id === "string" && data.email_id) ||
    (typeof data.id === "string" && data.id) ||
    "";
  if (!externalId) return null;

  const from = extractAddress(data.from);
  if (!from) return null;

  const subject =
    typeof data.subject === "string" && data.subject.trim().length > 0
      ? data.subject.trim()
      : "(sem assunto)";

  let text = "";
  if (typeof data.text === "string" && data.text.trim().length > 0) {
    text = data.text.trim();
  } else if (typeof data.html === "string" && data.html.trim().length > 0) {
    text = htmlToText(data.html);
  }
  if (!text) text = "[e-mail sem conteúdo de texto]";

  let occurredAt: string | null = null;
  const created = data.created_at ?? root.created_at;
  if (typeof created === "string" && created.length > 0) {
    const ts = new Date(created);
    if (!Number.isNaN(ts.getTime())) occurredAt = ts.toISOString();
  }

  return { externalId, from, subject, text, occurredAt };
}

/** A `crm_contacts` row resolved for an inbound sender. */
interface MatchedContact {
  id: string;
  sector_id: string;
}

/**
 * Matches a sender email against `crm_contacts`. The address is compared
 * case-insensitively against the stored contact email.
 *
 * When more than one distinct contact shares the address the sender is
 * ambiguous and is treated as UNMATCHED rather than guessing — an inbound
 * email must never be threaded onto the wrong contact's deal.
 */
async function findContactByEmail(
  client: SupabaseClient,
  fromEmail: string
): Promise<MatchedContact | null> {
  const { data } = await client
    .from("crm_contacts")
    .select("id, sector_id, email")
    .eq("is_active", true)
    .ilike("email", fromEmail)
    .limit(50);

  const matches: MatchedContact[] = [];
  const seen = new Set<string>();
  for (const c of (data ?? []) as (MatchedContact & {
    email: string | null;
  })[]) {
    if (!c.email) continue;
    if (c.email.trim().toLowerCase() === fromEmail && !seen.has(c.id)) {
      seen.add(c.id);
      matches.push({ id: c.id, sector_id: c.sector_id });
    }
  }

  // Exactly one contact -> a confident match. Zero or many -> unmatched.
  return matches.length === 1 ? matches[0] : null;
}

/** Outcome of fanning an inbound email into the timeline. */
export interface InboundEmailLogResult {
  /** True when an inbound email was found in the payload. */
  parsed: boolean;
  /** True when the email was logged as a new activity. */
  logged: boolean;
  /** True when the sender matched no contact (skipped, not an error). */
  unmatched: boolean;
  /** True when the email was already logged (idempotency collision). */
  duplicate: boolean;
}

/**
 * Logs one inbound email in `body` onto `crm_activities`.
 *
 *  - Parses the Resend inbound-email payload; a non-inbound / unparseable body
 *    yields `parsed: false`.
 *  - Looks up the sender contact; an unknown address yields `unmatched: true`.
 *  - Resolves the contact's most recent open deal so the email threads onto
 *    the deal timeline (falls back to a contact-only activity).
 *  - Inserts an inbound `email`-channel activity keyed by the provider message
 *    id; a unique `external_ref` collision (webhook redelivery) is reported as
 *    `duplicate: true`.
 *
 * Never throws — a failure is swallowed so a single bad email cannot fail the
 * whole webhook. The route already records the raw event for replay.
 */
export async function logInboundEmail(
  client: SupabaseClient,
  body: unknown
): Promise<InboundEmailLogResult> {
  const result: InboundEmailLogResult = {
    parsed: false,
    logged: false,
    unmatched: false,
    duplicate: false,
  };

  const email = parseInboundEmail(body);
  if (!email) return result;
  result.parsed = true;

  try {
    const contact = await findContactByEmail(client, email.from);
    if (!contact) {
      result.unmatched = true;
      return result;
    }

    // Thread onto the contact's most recent still-open deal, when one exists.
    const { data: deal } = await client
      .from("crm_deals")
      .select("id")
      .eq("contact_id", contact.id)
      .is("actual_close_date", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();

    const { error } = await client.from("crm_activities").insert({
      sector_id: contact.sector_id,
      deal_id: deal?.id ?? null,
      contact_id: contact.id,
      type: "email",
      channel: "email",
      direction: "inbound",
      subject: email.subject,
      description: `De: ${email.from}\n---\n${email.text}`,
      external_ref: email.externalId,
      occurred_at: email.occurredAt ?? new Date().toISOString(),
      // The webhook has no user session. An inbound email has no internal
      // performer — migration 00126 makes `performed_by` nullable for
      // `direction = 'inbound'` rows.
      performed_by: null,
    });

    if (error) {
      // 23505 = unique violation on idx_crm_activities_external_ref.
      if (error.code === "23505") result.duplicate = true;
      return result;
    }
    result.logged = true;
  } catch {
    // Best-effort: a bad email never fails the webhook.
  }

  return result;
}
