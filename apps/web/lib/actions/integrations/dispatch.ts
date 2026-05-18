"use server";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { enqueueDispatchSchema } from "@/lib/validations/integrations";
import {
  dispatchBatch,
  type DispatchPorts,
  type OutboxRow,
} from "@/lib/integrations/dispatch";
import { loadCredentialFor } from "@/lib/integrations/credential-loader";
import type { IntegrationChannel } from "@/lib/integrations/types";
import { revalidatePath } from "next/cache";

/**
 * Outbound notification dispatch server actions.
 *
 * `enqueueEventDispatch` resolves the channels an event routes to (from
 * `notification_channel_routes`) and writes one `notification_outbox` row per
 * channel. `runOutboxDispatch` drains pending rows through the channel
 * adapters — it is the worker entrypoint (a scheduled function or an admin
 * "send now" button can both call it).
 *
 * This generalises the existing in-app `notifications` flow WITHOUT replacing
 * it: an in-app notification is created as before; calling `enqueueEventDispatch`
 * additionally fans it out to Teams / WhatsApp.
 */

const OUTBOX_BATCH_SIZE = 25;

/** Builds the {@link DispatchPorts} backed by a Supabase client. */
function makePorts(client: SupabaseClient): DispatchPorts {
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
 * Enqueues outbound deliveries for an event. Reads the configured routes for
 * `(sectorId, eventType)` and inserts one outbox row per enabled channel.
 * Returns the number of rows enqueued.
 */
export async function enqueueEventDispatch(formData: unknown) {
  const parsed = enqueueDispatchSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { sectorId, eventType } = parsed.data;
  const perms = await getUserPermissions(user.id);
  if (sectorId === null) {
    if (!perms.isGlobalAdmin) return { error: "Sem permissao" };
  } else if (!hasPermission(perms, sectorId, "integration", "create")) {
    return { error: "Sem permissao" };
  }

  // Resolve the routes: enabled rows for this event in this sector OR global.
  const routeQuery = supabase
    .from("notification_channel_routes")
    .select("channel, sector_id")
    .eq("event_type", eventType)
    .eq("is_enabled", true);
  const { data: routes, error: routeErr } = await routeQuery;
  if (routeErr) return { error: routeErr.message };

  const channels = new Set<IntegrationChannel>();
  for (const r of routes ?? []) {
    if (r.sector_id === null || r.sector_id === sectorId) {
      channels.add(r.channel as IntegrationChannel);
    }
  }
  // in_app is the native path — never enqueued for external dispatch.
  channels.delete("in_app");

  if (channels.size === 0) {
    return { success: true, enqueued: 0 };
  }

  const rows = [...channels].map((channel) => ({
    sector_id: sectorId,
    channel,
    target: parsed.data.target ?? null,
    event_type: eventType,
    payload: {
      title: parsed.data.title,
      body: parsed.data.body,
      ...(parsed.data.url ? { url: parsed.data.url } : {}),
    },
    created_by: user.id,
  }));

  const { error } = await supabase.from("notification_outbox").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/settings/integrations");
  return { success: true, enqueued: rows.length };
}

/**
 * Drains pending outbox rows through their channel adapters. Returns a summary
 * of sent / failed / pending counts. Requires global-admin (it is the worker
 * entrypoint and processes rows across every sector).
 */
export async function runOutboxDispatch() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const perms = await getUserPermissions(user.id);
  if (!perms.isGlobalAdmin) return { error: "Sem permissao" };

  const { data: pending, error } = await supabase
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

  const outcomes = await dispatchBatch(rows, makePorts(supabase));

  revalidatePath("/settings/integrations");
  return {
    success: true,
    processed: outcomes.length,
    sent: outcomes.filter((o) => o.status === "sent").length,
    failed: outcomes.filter((o) => o.status === "failed").length,
    retrying: outcomes.filter((o) => o.status === "pending").length,
  };
}
