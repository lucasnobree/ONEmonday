/**
 * Service-role-backed contract-renewal notification worker.
 *
 * The renewal/notice-window detection already exists (`lib/legal/renewal.ts`
 * and the `get_contracts_needing_renewal_notice` RPC). This worker is the
 * missing delivery channel (docs/research/ux-audit-legal.md item #4): it scans
 * for contracts that have entered the termination-notice window, then for each
 * one — exactly once, tracked by `legal_contracts.renewal_notified_at`:
 *
 *   1. inserts an in-app `notifications` row for the contract owner (the native
 *      Phase-0 notification path, untouched);
 *   2. ADDITIONALLY enqueues one `notification_outbox` row per external channel
 *      configured for the `contract_renewal` event in `notification_channel_
 *      routes` — reusing the Phase-1 integration layer (migration 00103). The
 *      outbox is then drained by the existing dispatch worker / cron job.
 *
 * The scheduled `app/api/cron/legal-renewals` route passes the service-role
 * Supabase client, which bypasses RLS so the worker scans every sector. The
 * logic takes the client as a parameter, keeping this module free of
 * `next/headers` and therefore unit-testable with a mock.
 *
 * Server-only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildRenewalMessage,
  RENEWAL_EVENT_TYPE,
  type RenewalCandidate,
} from "./renewal-notice";

/** Max contracts processed in one scan — keeps a run bounded. */
const RENEWAL_BATCH_SIZE = 100;

/** A summary of one renewal-scan pass. */
export interface RenewalScanSummary {
  /** Contracts the RPC flagged as needing a notice. */
  scanned: number;
  /** Contracts an alert was dispatched for (in-app rows created). */
  notified: number;
  /** In-app notification rows inserted. */
  inAppCreated: number;
  /** Outbox rows enqueued for external channels (Teams / WhatsApp). */
  outboxEnqueued: number;
}

/**
 * Runs one renewal scan against the supplied (service-role) Supabase client.
 *
 * Idempotent: `renewal_notified_at` is stamped once the alert is dispatched,
 * and the RPC only returns contracts where it is still NULL — re-running the
 * worker the same day is a no-op for already-notified contracts.
 *
 * Never throws: a query error is returned as `{ error }`.
 */
export async function runRenewalScanWithClient(
  client: SupabaseClient
): Promise<{ error: string } | RenewalScanSummary> {
  const { data: candidates, error } = await client.rpc(
    "get_contracts_needing_renewal_notice"
  );
  if (error) return { error: error.message };

  const rows = ((candidates ?? []) as RenewalCandidate[]).slice(
    0,
    RENEWAL_BATCH_SIZE
  );
  if (rows.length === 0) {
    return { scanned: 0, notified: 0, inAppCreated: 0, outboxEnqueued: 0 };
  }

  // Resolve external channels routed for the renewal event, once. The native
  // in_app channel is delivered by the direct `notifications` insert below, so
  // it is never enqueued for external dispatch.
  const { data: routes } = await client
    .from("notification_channel_routes")
    .select("channel, sector_id")
    .eq("event_type", RENEWAL_EVENT_TYPE)
    .eq("is_enabled", true);

  let notified = 0;
  let inAppCreated = 0;
  let outboxEnqueued = 0;

  for (const candidate of rows) {
    const message = buildRenewalMessage(candidate);

    // 1. In-app notification for the contract owner. Skipped when the contract
    //    has no owner — there is no recipient, but the contract is still
    //    stamped so it is not re-scanned every day.
    if (candidate.owner_id) {
      const { error: notifyErr } = await client.from("notifications").insert({
        user_id: candidate.owner_id,
        type: RENEWAL_EVENT_TYPE,
        title: message.title,
        content: message.body,
        resource_type: "legal_contract",
        resource_id: candidate.contract_id,
      });
      if (!notifyErr) inAppCreated += 1;
    }

    // 2. External channels — enqueue one outbox row per routed channel.
    const channels = new Set<string>();
    for (const route of routes ?? []) {
      if (route.sector_id === null || route.sector_id === candidate.sector_id) {
        if (route.channel !== "in_app") channels.add(route.channel);
      }
    }
    if (channels.size > 0) {
      const outboxRows = [...channels].map((channel) => ({
        sector_id: candidate.sector_id,
        channel,
        target: null,
        event_type: RENEWAL_EVENT_TYPE,
        payload: {
          title: message.title,
          body: message.body,
          url: message.url,
        },
        // The worker has no user session. `notification_outbox.created_by` is
        // NOT NULL, so the dispatch is attributed to the contract's owner when
        // set, otherwise to whoever created the contract — always a real user.
        created_by: candidate.owner_id ?? candidate.created_by,
      }));
      const { error: outboxErr } = await client
        .from("notification_outbox")
        .insert(outboxRows);
      if (!outboxErr) outboxEnqueued += outboxRows.length;
    }

    // 3. Stamp the contract so it is not alerted again.
    const { error: stampErr } = await client
      .from("legal_contracts")
      .update({ renewal_notified_at: new Date().toISOString() })
      .eq("id", candidate.contract_id);
    if (!stampErr) notified += 1;
  }

  return {
    scanned: rows.length,
    notified,
    inAppCreated,
    outboxEnqueued,
  };
}

export { RENEWAL_BATCH_SIZE };
