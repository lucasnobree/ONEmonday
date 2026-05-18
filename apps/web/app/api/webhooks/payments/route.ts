/**
 * Inbound webhook — payment PSP (Asaas).
 *
 * Payment confirmation is asynchronous: a customer pays a boleto / PIX charge
 * hours-to-days after it was issued, and Asaas calls this route to report it.
 * The route verifies the shared-secret HMAC, logs the event for idempotency
 * (`webhook_events`), updates the matching `finance_payment_charges` row, and —
 * when the charge is confirmed received — marks the linked invoice `paid`.
 *
 * The HMAC secret is read from the global `payments`-capability credential
 * (`webhookSecret` in the encrypted blob). With no credential / no service-role
 * key the route degrades to a safe response — dev runs without configuration.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { decryptSecretJson } from "@/lib/integrations/crypto";
import { verifyHmacSignature } from "@/lib/integrations/signature";
import { makeWebhookPorts } from "@/lib/integrations/webhook-ports";
import { processWebhook } from "@/lib/integrations/webhook";
import { mapAsaasStatus } from "@/lib/integrations/payments/asaas-adapter";

export const dynamic = "force-dynamic";

interface PaymentSecret {
  webhookSecret?: string;
}

/** Loads and decrypts the global `payments`-capability webhook secret. */
async function loadPaymentSecret(): Promise<PaymentSecret | null> {
  if (!hasServiceRoleKey()) return null;
  const client = createServiceClient();
  const { data } = await client
    .from("integration_credentials")
    .select("secret")
    .eq("capability", "payments")
    .eq("is_active", true)
    .is("sector_id", null)
    .maybeSingle<{ secret: string | null }>();
  if (!data?.secret) return null;
  try {
    return decryptSecretJson<PaymentSecret>(data.secret);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!hasServiceRoleKey()) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const secret = await loadPaymentSecret();
  const signatureOk = verifyHmacSignature(
    secret?.webhookSecret ?? "",
    rawBody,
    request.headers.get("x-webhook-signature") ??
      request.headers.get("asaas-access-token")
  );

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Asaas wraps the charge under `payment`; `event` is the discriminator.
  const payment =
    typeof body.payment === "object" && body.payment !== null
      ? (body.payment as Record<string, unknown>)
      : {};
  const reference =
    typeof payment.externalReference === "string"
      ? payment.externalReference
      : "";
  const eventType = typeof body.event === "string" ? body.event : null;
  // Asaas sends a unique `id` per webhook delivery — the idempotency key.
  const externalId =
    (typeof body.id === "string" && body.id) ||
    (reference && eventType ? `${reference}:${eventType}` : reference);

  const service = createServiceClient();
  const ports = makeWebhookPorts(service);

  const outcome = await processWebhook(
    {
      provider: "asaas",
      externalId,
      eventType,
      payload: body,
      signatureOk,
    },
    ports,
    async () => {
      if (!reference) return;
      const status = mapAsaasStatus(payment.status);

      const { data: charge } = await service
        .from("finance_payment_charges")
        .update({ status, last_payload: body })
        .eq("provider", "asaas")
        .eq("reference", reference)
        .select("invoice_id")
        .maybeSingle<{ invoice_id: string }>();

      // A confirmed charge settles the linked invoice.
      if (status === "received" && charge?.invoice_id) {
        await service
          .from("finance_invoices")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
          })
          .eq("id", charge.invoice_id)
          .neq("status", "paid");
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
