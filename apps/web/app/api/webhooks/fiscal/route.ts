/**
 * Inbound webhook — fiscal gateway (Focus NFe).
 *
 * SEFAZ/prefeitura authorisation is asynchronous: Focus NFe accepts an emission
 * request and reports the authorised / rejected outcome seconds-to-minutes
 * later by calling this route. The route verifies the shared-secret HMAC, logs
 * the event for idempotency (`webhook_events`), then updates the matching
 * `finance_fiscal_documents` row by its `reference`.
 *
 * The HMAC secret is read from the global `fiscal`-capability credential
 * (`webhookSecret` in the encrypted blob). With no credential / no service-role
 * key the route degrades to a safe response — dev runs without configuration.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { decryptSecretJson } from "@/lib/integrations/crypto";
import { verifyHmacSignature } from "@/lib/integrations/signature";
import { makeWebhookPorts } from "@/lib/integrations/webhook-ports";
import { processWebhook } from "@/lib/integrations/webhook";
import { mapFocusStatus } from "@/lib/integrations/fiscal/focus-nfe-adapter";

export const dynamic = "force-dynamic";

interface FiscalSecret {
  webhookSecret?: string;
}

/** Loads and decrypts the global `fiscal`-capability webhook secret. */
async function loadFiscalSecret(): Promise<FiscalSecret | null> {
  if (!hasServiceRoleKey()) return null;
  const client = createServiceClient();
  const { data } = await client
    .from("integration_credentials")
    .select("secret")
    .eq("capability", "fiscal")
    .eq("is_active", true)
    .is("sector_id", null)
    .maybeSingle<{ secret: string | null }>();
  if (!data?.secret) return null;
  try {
    return decryptSecretJson<FiscalSecret>(data.secret);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!hasServiceRoleKey()) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const secret = await loadFiscalSecret();
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

  // Focus NFe echoes our `ref` (the fiscal document reference) and a `status`.
  const reference =
    typeof body.ref === "string" && body.ref ? body.ref : "";
  const externalId =
    reference && typeof body.status === "string"
      ? `${reference}:${body.status}`
      : reference;

  const service = createServiceClient();
  const ports = makeWebhookPorts(service);

  const outcome = await processWebhook(
    {
      provider: "focus_nfe",
      externalId,
      eventType: typeof body.status === "string" ? body.status : null,
      payload: body,
      signatureOk,
    },
    ports,
    async () => {
      // Domain side effect: update the fiscal document by its reference.
      if (!reference) return;
      const status = mapFocusStatus(body.status);
      await service
        .from("finance_fiscal_documents")
        .update({
          status,
          protocol:
            typeof body.numero === "string" ? body.numero : undefined,
          access_key:
            typeof body.chave_nfe === "string" ? body.chave_nfe : undefined,
          pdf_url:
            typeof body.caminho_danfe === "string"
              ? body.caminho_danfe
              : undefined,
          xml_url:
            typeof body.caminho_xml_nota_fiscal === "string"
              ? body.caminho_xml_nota_fiscal
              : undefined,
          status_reason:
            typeof body.mensagem_sefaz === "string"
              ? body.mensagem_sefaz
              : null,
          last_payload: body,
        })
        .eq("provider", "focus_nfe")
        .eq("reference", reference);
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
