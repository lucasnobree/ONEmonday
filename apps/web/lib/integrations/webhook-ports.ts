/**
 * Service-role-backed {@link WebhookPorts} for the inbound webhook routes.
 *
 * Webhook routes run with no user session, so they use the service-role
 * Supabase client (RLS-bypassing) — see lib/supabase/service.ts. Idempotency
 * is enforced by the `webhook_events` unique index on (provider, external_id):
 * a duplicate insert returns Postgres error code `23505`, which this maps to
 * the `duplicate` record state.
 *
 * Server-only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WebhookPorts, WebhookEventStatus } from "./webhook";

/** Postgres unique-violation error code. */
const UNIQUE_VIOLATION = "23505";

/** Builds {@link WebhookPorts} backed by a service-role Supabase client. */
export function makeWebhookPorts(client: SupabaseClient): WebhookPorts {
  return {
    async recordEvent(input) {
      const { error } = await client.from("webhook_events").insert({
        provider: input.provider,
        external_id: input.externalId,
        event_type: input.eventType,
        payload: input.payload,
        signature_ok: input.signatureOk,
        status: "received",
      });
      if (error) {
        if (error.code === UNIQUE_VIOLATION) {
          // Read back the stored row's status: a prior `failed` attempt is
          // re-processable, any other status is a true idempotent replay.
          const { data } = await client
            .from("webhook_events")
            .select("status")
            .eq("provider", input.provider)
            .eq("external_id", input.externalId)
            .maybeSingle<{ status: WebhookEventStatus }>();
          return {
            state: "duplicate",
            status: data?.status ?? "received",
          };
        }
        throw new Error(error.message);
      }
      return { state: "new" };
    },
    async resetEvent(input) {
      await client
        .from("webhook_events")
        .update({ status: "received", error: null, processed_at: null })
        .eq("provider", input.provider)
        .eq("external_id", input.externalId);
    },
    async finalizeEvent(input) {
      await client
        .from("webhook_events")
        .update({
          status: input.status,
          error: input.error ?? null,
          processed_at: new Date().toISOString(),
        })
        .eq("provider", input.provider)
        .eq("external_id", input.externalId);
    },
  };
}
