/**
 * Inbound WhatsApp -> `crm_activities` fan-out.
 *
 * The `/api/webhooks/whatsapp` route receives WhatsApp Business Cloud API
 * webhooks. Delivery-status callbacks are ignored here; an *inbound message*
 * (a contact replying) is logged onto the CRM timeline so the deal shows the
 * full conversation — the RD Station CRM "WhatsApp inside the deal" behaviour
 * (docs/research/migration-architecture.md §2.7).
 *
 * The route runs with the service-role client (no user session), so scoping is
 * enforced in code, not RLS: a received message is only logged when its sender
 * phone number matches a known `crm_contacts` row — that contact's sector and
 * any open deal anchor the activity. An unknown number is skipped (not an
 * error) so spam / wrong-number messages never create orphan rows.
 *
 * `parseInboundMessages` is pure and DB-agnostic, so it is fully unit-testable;
 * `logInboundWhatsApp` supplies the service-role-backed side effects.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "./messaging/whatsapp-adapter";

/** A single inbound WhatsApp text message extracted from a webhook body. */
export interface InboundWhatsAppMessage {
  /** Provider message id (`wamid.*`) — the idempotency key. */
  externalId: string;
  /** Sender phone, digits only. */
  from: string;
  /** Message text. Non-text messages (image, audio...) carry a placeholder. */
  text: string;
  /** Provider epoch timestamp (seconds) as ISO, or null when absent. */
  occurredAt: string | null;
}

/** Maps a WhatsApp message `type` to a short placeholder for non-text media. */
const MEDIA_PLACEHOLDER: Record<string, string> = {
  image: "[imagem recebida]",
  audio: "[áudio recebido]",
  video: "[vídeo recebido]",
  document: "[documento recebido]",
  sticker: "[figurinha recebida]",
  location: "[localização recebida]",
  contacts: "[contato recebido]",
};

/**
 * Extracts inbound text messages from a WhatsApp Cloud API webhook body.
 *
 * Status-only callbacks (sent/delivered/read) yield an empty array — those are
 * not conversation entries. A message with no usable text falls back to a
 * media placeholder so the timeline still records that a reply arrived.
 */
export function parseInboundMessages(body: unknown): InboundWhatsAppMessage[] {
  const out: InboundWhatsAppMessage[] = [];
  let changes: { value?: Record<string, unknown> }[] = [];
  try {
    changes =
      (body as { entry?: { changes?: { value?: Record<string, unknown> }[] }[] })
        .entry?.flatMap((e) => e.changes ?? []) ?? [];
  } catch {
    return out;
  }

  for (const change of changes) {
    const messages = change.value?.messages as
      | {
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        }[]
      | undefined;
    if (!Array.isArray(messages)) continue;

    for (const msg of messages) {
      if (!msg.id || !msg.from) continue;
      const type = msg.type ?? "text";
      const text =
        type === "text"
          ? msg.text?.body?.trim() || "[mensagem vazia]"
          : MEDIA_PLACEHOLDER[type] ?? `[${type} recebido]`;

      let occurredAt: string | null = null;
      const epoch = Number(msg.timestamp);
      if (Number.isFinite(epoch) && epoch > 0) {
        occurredAt = new Date(epoch * 1000).toISOString();
      }

      out.push({
        externalId: msg.id,
        from: normalizePhone(msg.from),
        text,
        occurredAt,
      });
    }
  }
  return out;
}

/** A `crm_contacts` row resolved for an inbound sender. */
interface MatchedContact {
  id: string;
  sector_id: string;
  phone: string | null;
}

/**
 * The national significant number — area code + local number — of a Brazilian
 * phone, derived from a digits-only string. WhatsApp reports `55` + 2-digit
 * area + 8/9-digit local (12-13 digits); stored contact phones are free-text
 * and may or may not carry the `55` country code.
 *
 * Returns the last 10-11 digits (area + local) once the optional leading `55`
 * is stripped, or null when the string is too short to be a real number. The
 * national number is what we match on — it is specific enough that a match is
 * the same person, unlike a bare 8-digit local suffix which collides across
 * area codes.
 */
export function nationalNumber(digits: string): string | null {
  let d = digits;
  // Strip the Brazil country code only when what remains is still a full
  // national number (10-11 digits) — avoids eating real leading digits.
  if (d.startsWith("55") && d.length >= 12 && d.length <= 13) {
    d = d.slice(2);
  }
  // A Brazilian national number is 10 (landline / 8-digit mobile) or 11
  // (9-digit mobile) digits. Anything shorter is not matchable.
  if (d.length < 10 || d.length > 11) return null;
  return d;
}

/**
 * Matches a sender phone against `crm_contacts`. WhatsApp reports numbers with
 * country code and no separators; stored contact phones are free-text, so the
 * match compares on the *national significant number* (area code + local) with
 * the optional `55` country code normalised away on both sides.
 *
 * A full national-number match is required — no loose suffix containment, which
 * would cross-match different people who share an 8-digit local number under
 * different area codes. When more than one distinct contact matches, the sender
 * is ambiguous and is treated as UNMATCHED rather than guessing — an inbound
 * message must never be threaded onto the wrong contact's deal.
 */
async function findContactByPhone(
  client: SupabaseClient,
  fromDigits: string
): Promise<MatchedContact | null> {
  const target = nationalNumber(fromDigits);
  if (!target) return null;

  // Cheap first pass: candidates whose phone shares the local 8-digit suffix.
  // The exact decision below is made on the full national number.
  const suffix = target.slice(-8);

  const { data } = await client
    .from("crm_contacts")
    .select("id, sector_id, phone")
    .eq("is_active", true)
    .ilike("phone", `%${suffix}%`)
    .limit(50);

  const matches: MatchedContact[] = [];
  const seen = new Set<string>();
  for (const c of (data ?? []) as MatchedContact[]) {
    if (!c.phone) continue;
    const candidate = nationalNumber(normalizePhone(c.phone));
    if (candidate && candidate === target && !seen.has(c.id)) {
      seen.add(c.id);
      matches.push(c);
    }
  }

  // Exactly one contact -> a confident match. Zero or many -> unmatched.
  return matches.length === 1 ? matches[0] : null;
}

/** Outcome summary of fanning a webhook body into the timeline. */
export interface InboundLogResult {
  /** Inbound messages found in the payload. */
  parsed: number;
  /** Messages logged as a new activity. */
  logged: number;
  /** Messages whose sender matched no contact (skipped, not an error). */
  unmatched: number;
  /** Messages already logged (idempotency — `external_ref` collision). */
  duplicate: number;
}

/**
 * Fans every inbound WhatsApp message in `body` into `crm_activities`.
 *
 *  - Looks up the sender contact; an unknown number is counted `unmatched`.
 *  - Resolves the contact's most recent open deal so the message threads onto
 *    the deal timeline (falls back to a contact-only activity).
 *  - Inserts an inbound activity keyed by the provider message id; a unique
 *    `external_ref` collision (webhook redelivery) is counted `duplicate`.
 *
 * Never throws — a per-message failure is swallowed so one bad message cannot
 * fail the whole webhook. The route already records the raw event for replay.
 */
export async function logInboundWhatsApp(
  client: SupabaseClient,
  body: unknown
): Promise<InboundLogResult> {
  const messages = parseInboundMessages(body);
  const result: InboundLogResult = {
    parsed: messages.length,
    logged: 0,
    unmatched: 0,
    duplicate: 0,
  };

  for (const msg of messages) {
    try {
      const contact = await findContactByPhone(client, msg.from);
      if (!contact) {
        result.unmatched += 1;
        continue;
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
        type: "note",
        channel: "whatsapp",
        direction: "inbound",
        subject: `WhatsApp recebido de ${msg.from}`,
        description: msg.text,
        external_ref: msg.externalId,
        occurred_at: msg.occurredAt ?? new Date().toISOString(),
        // The webhook has no user session. An inbound message has no internal
        // performer — migration 00126 makes `performed_by` nullable for
        // `direction = 'inbound'` rows.
        performed_by: null,
      });

      if (error) {
        // 23505 = unique violation on idx_crm_activities_external_ref.
        if (error.code === "23505") {
          result.duplicate += 1;
        }
        continue;
      }
      result.logged += 1;
    } catch {
      // Best-effort: a single bad message never fails the webhook.
    }
  }

  return result;
}
