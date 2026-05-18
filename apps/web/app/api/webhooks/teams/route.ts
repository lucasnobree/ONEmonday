/**
 * Inbound webhook — Microsoft Teams.
 *
 * A Teams Workflow can be configured to call back into ONEmonday (e.g. an
 * outcome / acknowledgement). The Workflow is set up to send a shared-secret
 * HMAC of the raw body in the `X-Webhook-Signature` header; we verify it, log
 * the event for idempotency, then acknowledge.
 *
 * The HMAC secret is read from the `teams` integration credential
 * (sector_id NULL = the global credential): the encrypted blob carries
 * `webhookSecret`. With no credential / no service-role key the route
 * degrades to a safe response — dev runs without configuration.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { decryptSecretJson } from "@/lib/integrations/crypto";
import { verifyHmacSignature } from "@/lib/integrations/signature";
import { makeWebhookPorts } from "@/lib/integrations/webhook-ports";
import { processWebhook } from "@/lib/integrations/webhook";

export const dynamic = "force-dynamic";

interface TeamsSecret {
  webhookSecret?: string;
}

/** Loads and decrypts the global `teams` credential secret blob. */
async function loadTeamsSecret(): Promise<TeamsSecret | null> {
  if (!hasServiceRoleKey()) return null;
  const client = createServiceClient();
  const { data } = await client
    .from("integration_credentials")
    .select("secret")
    .eq("provider", "teams")
    .eq("is_active", true)
    .is("sector_id", null)
    .maybeSingle<{ secret: string | null }>();
  if (!data?.secret) return null;
  try {
    return decryptSecretJson<TeamsSecret>(data.secret);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!hasServiceRoleKey()) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const secret = await loadTeamsSecret();
  const signatureOk = verifyHmacSignature(
    secret?.webhookSecret ?? "",
    rawBody,
    request.headers.get("x-webhook-signature")
  );

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Teams payloads carry no canonical event id — accept `id`/`messageId`.
  const externalId =
    (typeof body.id === "string" && body.id) ||
    (typeof body.messageId === "string" && body.messageId) ||
    "";
  const eventType =
    typeof body.eventType === "string" ? body.eventType : null;

  const ports = makeWebhookPorts(createServiceClient());
  const outcome = await processWebhook(
    {
      provider: "teams",
      externalId,
      eventType,
      payload: body,
      signatureOk,
    },
    ports,
    async () => {}
  );

  if (outcome.ok) {
    return NextResponse.json({ ok: true, state: outcome.state });
  }
  return NextResponse.json(
    { ok: false, reason: outcome.reason },
    { status: outcome.status }
  );
}
