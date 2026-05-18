/**
 * Inbound webhook — WhatsApp Business Cloud API.
 *
 * GET  — Meta's webhook verification handshake (`hub.challenge`).
 * POST — delivery-status updates and inbound messages. The body is signed by
 *        Meta with `X-Hub-Signature-256` (HMAC-SHA256 over the raw body keyed
 *        by the app secret). We verify it, log the event for idempotency, then
 *        acknowledge.
 *
 * Secrets are read from the `whatsapp` integration credential (sector_id NULL
 * = the global credential): the encrypted blob carries `appSecret` and
 * `verifyToken`. With no credential / no service-role key the route degrades
 * to a safe response instead of crashing — dev runs without configuration.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { decryptSecretJson } from "@/lib/integrations/crypto";
import { verifyMetaSignature } from "@/lib/integrations/signature";
import { makeWebhookPorts } from "@/lib/integrations/webhook-ports";
import { processWebhook } from "@/lib/integrations/webhook";
import { logInboundWhatsApp } from "@/lib/integrations/crm-inbound";

export const dynamic = "force-dynamic";

interface WhatsAppSecret {
  appSecret?: string;
  verifyToken?: string;
}

/** Loads and decrypts the global `whatsapp` credential secret blob. */
async function loadWhatsAppSecret(): Promise<WhatsAppSecret | null> {
  if (!hasServiceRoleKey()) return null;
  const client = createServiceClient();
  const { data } = await client
    .from("integration_credentials")
    .select("secret")
    .eq("provider", "whatsapp")
    .eq("is_active", true)
    .is("sector_id", null)
    .maybeSingle<{ secret: string | null }>();
  if (!data?.secret) return null;
  try {
    return decryptSecretJson<WhatsAppSecret>(data.secret);
  } catch {
    return null;
  }
}

/** Meta webhook verification handshake. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  const secret = await loadWhatsAppSecret();
  if (
    mode === "subscribe" &&
    secret?.verifyToken &&
    token === secret.verifyToken &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/** Extracts the first event id from a WhatsApp Cloud API webhook body. */
function extractExternalId(body: unknown): { id: string; type: string | null } {
  try {
    const change = (
      body as {
        entry?: { changes?: { value?: Record<string, unknown> }[] }[];
      }
    ).entry?.[0]?.changes?.[0]?.value;
    const message = (change?.messages as { id?: string }[] | undefined)?.[0];
    const statusUpd = (change?.statuses as { id?: string }[] | undefined)?.[0];
    if (message?.id) return { id: message.id, type: "message" };
    if (statusUpd?.id) return { id: statusUpd.id, type: "status" };
  } catch {
    // fall through
  }
  return { id: "", type: null };
}

export async function POST(request: NextRequest) {
  // Read the RAW body once — signature verification needs the exact bytes.
  const rawBody = await request.text();

  if (!hasServiceRoleKey()) {
    // No service role configured — acknowledge so Meta does not retry-storm.
    return NextResponse.json({ ok: true, noop: true });
  }

  const secret = await loadWhatsAppSecret();
  const signatureOk = verifyMetaSignature(
    secret?.appSecret ?? "",
    rawBody,
    request.headers.get("x-hub-signature-256")
  );

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { id, type } = extractExternalId(body);

  const client = createServiceClient();
  const ports = makeWebhookPorts(client);
  const outcome = await processWebhook(
    {
      provider: "whatsapp",
      externalId: id,
      eventType: type,
      payload: body,
      signatureOk,
    },
    ports,
    // Domain handler: an inbound message (a contact replying) is fanned into
    // `crm_activities` so the deal timeline shows the conversation — the RD
    // Station CRM "WhatsApp inside the deal" behaviour. Delivery-status
    // callbacks carry no conversation content and are a no-op here.
    async (parsed) => {
      if (parsed.eventType === "message") {
        await logInboundWhatsApp(client, parsed.payload);
      }
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
