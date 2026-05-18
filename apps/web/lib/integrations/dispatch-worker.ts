/**
 * Service-role-backed outbox dispatch worker.
 *
 * The Phase-1 server action `runOutboxDispatch` is the manual entrypoint — it
 * runs inside a user session and is reached by the admin "Processar agora"
 * button. The scheduled `app/api/cron/dispatch-outbox` route cannot use a user
 * session, so it calls {@link runOutboxDispatchWithClient} with the
 * service-role Supabase client instead.
 *
 * Both paths share the SAME pure logic — `dispatchBatch` from `./dispatch` —
 * so the automatic and manual triggers behave identically. This module only
 * supplies the {@link DispatchPorts} backed by a caller-provided client, which
 * keeps it free of `next/headers` and therefore unit-testable with a mock.
 *
 * Server-only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dispatchBatch,
  type DispatchPorts,
  type OutboxRow,
} from "./dispatch";
import { loadCredentialFor } from "./credential-loader";
import type { IntegrationChannel } from "./types";

/** Max pending rows drained in one run — mirrors the server action's batch. */
const OUTBOX_BATCH_SIZE = 25;

/** A summary of one dispatch run. */
export interface OutboxDispatchSummary {
  processed: number;
  sent: number;
  failed: number;
  retrying: number;
}

/** Builds the {@link DispatchPorts} backed by an arbitrary Supabase client. */
export function makeDispatchPorts(client: SupabaseClient): DispatchPorts {
  return {
    loadCredential: (channel, sectorId) =>
      loadCredentialFor(client, channel, sectorId),
    markOutbox: async (id, update) => {
      const patch: Record<string, unknown> = {
        status: update.status,
        attempts: update.attempts,
        error: update.error ?? null,
      };
      if (update.providerRef !== undefined) {
        patch.provider_ref = update.providerRef;
      }
      if (update.status === "sent") {
        patch.sent_at = new Date().toISOString();
      }
      await client.from("notification_outbox").update(patch).eq("id", id);
    },
  };
}

/**
 * Drains a batch of pending outbox rows through their channel adapters using
 * the supplied Supabase client (the scheduled route passes a service-role
 * client, which bypasses RLS — the worker processes rows across every sector).
 *
 * Never throws: a query error is returned as `{ error }`; a per-row send
 * failure is recorded on the row by `dispatchBatch`.
 */
export async function runOutboxDispatchWithClient(
  client: SupabaseClient
): Promise<{ error: string } | OutboxDispatchSummary> {
  const { data: pending, error } = await client
    .from("notification_outbox")
    .select("id, sector_id, channel, target, event_type, payload, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(OUTBOX_BATCH_SIZE);
  if (error) return { error: error.message };

  const rows: OutboxRow[] = (pending ?? []).map((r) => ({
    id: r.id,
    sectorId: r.sector_id,
    channel: r.channel as IntegrationChannel,
    target: r.target,
    eventType: r.event_type,
    payload: (r.payload ?? {}) as OutboxRow["payload"],
    attempts: r.attempts ?? 0,
  }));

  const outcomes = await dispatchBatch(rows, makeDispatchPorts(client));

  return {
    processed: outcomes.length,
    sent: outcomes.filter((o) => o.status === "sent").length,
    failed: outcomes.filter((o) => o.status === "failed").length,
    retrying: outcomes.filter((o) => o.status === "pending").length,
  };
}

export { OUTBOX_BATCH_SIZE };
