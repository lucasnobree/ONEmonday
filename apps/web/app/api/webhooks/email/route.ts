/**
 * Inbound webhook — email (Resend ESP).
 *
 * POST — Resend delivers inbound-email events here. The body is signed Svix-
 *        style (`svix-id` / `svix-timestamp` / `svix-signature` headers, an
 *        HMAC-SHA256 over `id.timestamp.body` keyed by the webhook signing
 *        secret). We verify it, log the event for idempotency (`webhook_events`),
 *        fan a received email into `crm_activities`, then acknowledge.
 *
 * This is webhook-based inbound logging — emails the ESP forwards. A full IMAP
 * two-way mailbox sync is deliberately out of scope (migration-architecture.md
 * §2.8): the ONEmonday side owns the deal timeline, not a mailbox.
 *
 * The signing secret is read from the `email`-capability integration credential
 * (sector_id NULL = the global credential): the encrypted blob carries
 * `webhookSecret` (Resend `whsec_...`). With no credential / no service-role
 * key the route degrades to a safe response instead of crashing — dev runs
 * without configuration, exactly like the WhatsApp / payments webhooks.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { decryptSecretJson } from "@/lib/integrations/crypto";
import { verifySvixSignature } from "@/lib/integrations/signature";
import { makeWebhookPorts } from "@/lib/integrations/webhook-ports";
import { processWebhook } from "@/lib/integrations/webhook";
import { logInboundEmail } from "@/lib/integrations/crm-email-inbound";

export const dynamic = "force-dynamic";

interface EmailWebhookSecret {
  webhookSecret?: string;
}

/** Loads and decrypts the global `email`-capability webhook signing secret. */
async function loadEmailWebhookSecret(): Promise<EmailWebhookSecret | null> {
  if (!hasServiceRoleKey()) return null;
  const client = createServiceClient();
  const { data } = await client
    .from("integration_credentials")
    .select("secret")
    .eq("capability", "email")
    .eq("is_active", true)
    .eq("is_enabled", true)
    .is("sector_id", null)
    .maybeSingle<{ secret: string | null }>();
  if (!data?.secret) return null;
  try {
    return decryptSecretJson<EmailWebhookSecret>(data.secret);
  } catch {
    return null;
  }
}

/** Extracts the provider event id and type from a Resend webhook body. */
function extractEvent(body: unknown): { id: string; type: string | null } {
  if (typeof body !== "object" || body === null) {
    return { id: "", type: null };
  }
  const root = body as Record<string, unknown>;
  const type = typeof root.type === "string" ? root.type : null;
  const data =
    typeof root.data === "object" && root.data !== null
      ? (root.data as Record<string, unknown>)
      : root;
  const id =
    (typeof data.email_id === "string" && data.email_id) ||
    (typeof data.id === "string" && data.id) ||
    "";
  return { id, type };
}

export async function POST(request: NextRequest) {
  // Read the RAW body once — Svix signature verification needs exact bytes.
  const rawBody = await request.text();

  if (!hasServiceRoleKey()) {
    // No service role configured — acknowledge so Resend does not retry-storm.
    return NextResponse.json({ ok: true, noop: true });
  }

  const secret = await loadEmailWebhookSecret();
  const signatureOk = verifySvixSignature(
    secret?.webhookSecret ?? "",
    request.headers.get("svix-id"),
    request.headers.get("svix-timestamp"),
    rawBody,
    request.headers.get("svix-signature")
  );

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { id, type } = extractEvent(body);

  const client = createServiceClient();
  const ports = makeWebhookPorts(client);
  const outcome = await processWebhook(
    {
      provider: "resend",
      externalId: id,
      eventType: type,
      payload: body,
      signatureOk,
    },
    ports,
    // Domain handler: a received email from a known contact is fanned into
    // `crm_activities` so the deal "Comunicação" timeline shows it next to
    // WhatsApp. A delivery/bounce status event carries no inbound content and
    // logs nothing (parseInboundEmail yields no usable email).
    async (parsed) => {
      await logInboundEmail(client, parsed.payload);
    }
  );

  if (outcome.ok) {
    return NextResponse.json({ ok: true, state: outcome.state });
  }
  return NextResponse.json(
    { ok: false, reason: outcome.reason },
    { status: outcome.status }
  );
}
