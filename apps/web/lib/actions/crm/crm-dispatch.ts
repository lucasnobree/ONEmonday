import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrmEventPayload } from "@/lib/crm/crm-events";
import type { IntegrationChannel } from "@/lib/integrations/types";

/**
 * Enqueues a built CRM event onto the Phase-1 `notification_outbox`.
 *
 * This is the integration seam: CRM server actions (deal won/lost, stage
 * change, activity due) call `enqueueCrmEvent` after their own write succeeds.
 * It resolves the channels the event routes to (`notification_channel_routes`,
 * sector-scoped OR global) and writes one outbox row per external channel. A
 * worker (lib/actions/integrations/dispatch.ts → `runOutboxDispatch`) drains
 * the outbox and delivers to Teams / WhatsApp.
 *
 * Design choices:
 *  - It is **best-effort**: a CRM write must never fail because dispatch
 *    failed. Every path resolves to `{ enqueued }` and swallows errors.
 *  - `in_app` routes are skipped — that is the native `notifications` path,
 *    not an outbound dispatch.
 *  - It accepts an already-authenticated Supabase client and the acting user
 *    id, so it runs inside the caller's RLS context (the caller already did
 *    auth + permission checks for the domain write).
 */
export async function enqueueCrmEvent(
  supabase: SupabaseClient,
  args: {
    sectorId: string;
    userId: string;
    event: CrmEventPayload;
    /** Optional WhatsApp E.164 target. */
    target?: string | null;
  }
): Promise<{ enqueued: number }> {
  try {
    const { data: routes, error: routeErr } = await supabase
      .from("notification_channel_routes")
      .select("channel, sector_id")
      .eq("event_type", args.event.eventType)
      .eq("is_enabled", true);

    if (routeErr) return { enqueued: 0 };

    const channels = new Set<IntegrationChannel>();
    for (const r of routes ?? []) {
      // A route applies when it is global (sector_id null) or this sector.
      if (r.sector_id === null || r.sector_id === args.sectorId) {
        channels.add(r.channel as IntegrationChannel);
      }
    }
    // in_app is the native notifications path — never enqueued for dispatch.
    channels.delete("in_app");

    if (channels.size === 0) return { enqueued: 0 };

    const rows = [...channels].map((channel) => ({
      sector_id: args.sectorId,
      channel,
      target: args.target ?? null,
      event_type: args.event.eventType,
      payload: { title: args.event.title, body: args.event.body },
      created_by: args.userId,
    }));

    const { error } = await supabase.from("notification_outbox").insert(rows);
    if (error) return { enqueued: 0 };

    return { enqueued: rows.length };
  } catch {
    // Best-effort: dispatch failure must not break the CRM write.
    return { enqueued: 0 };
  }
}
