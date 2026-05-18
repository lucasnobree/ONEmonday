/**
 * Outbound notification dispatch — the worker logic.
 *
 * An in-app notification can ALSO be delivered to Teams / WhatsApp. The flow
 * (docs/research/migration-architecture.md §1.2e):
 *
 *   1. `enqueueOutbox` resolves the channels an event routes to (from
 *      `notification_channel_routes`) and writes one `notification_outbox`
 *      row per channel.
 *   2. `dispatchOutboxRow` takes a single pending row, resolves the channel's
 *      adapter from `integration_credentials`, sends, and reports the result.
 *
 * The logic here is transport- and DB-agnostic: it works against the small
 * {@link DispatchPorts} interface so it is fully unit-testable with mocks. The
 * server-action wrapper in lib/actions/integrations/dispatch.ts supplies the
 * real Supabase-backed implementation.
 */
import type { IntegrationChannel, OutboundMessage, SendResult } from "./types";
import { resolveChannel } from "./registry";

const MAX_ATTEMPTS = 3;

/** A pending outbox row, as drained by the dispatch worker. */
export interface OutboxRow {
  id: string;
  sectorId: string | null;
  channel: IntegrationChannel;
  target: string | null;
  eventType: string | null;
  payload: { title?: string; body?: string; url?: string };
  attempts: number;
}

/** A resolved credential for a channel, ready to construct an adapter. */
export interface ResolvedCredential {
  /** Decrypted secret blob, or null when the channel is unconfigured. */
  secret: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
}

/**
 * Side-effecting dependencies the dispatch logic needs. Implemented for real
 * by the server action; mocked in tests.
 */
export interface DispatchPorts {
  /**
   * Resolves the credential for `channel` in `sectorId` (falling back to a
   * global credential). Returns null when no credential row exists at all.
   */
  loadCredential(
    channel: IntegrationChannel,
    sectorId: string | null
  ): Promise<ResolvedCredential | null>;
  /** Persists the terminal state of an outbox row. */
  markOutbox(
    id: string,
    update: {
      status: "sent" | "failed" | "pending";
      attempts: number;
      error?: string | null;
      providerRef?: string | null;
    }
  ): Promise<void>;
}

/** Final outcome of dispatching one outbox row. */
export interface DispatchOutcome {
  id: string;
  status: "sent" | "failed" | "pending";
  result: SendResult;
}

/** Maps a raw outbox payload into a typed {@link OutboundMessage}. */
export function toOutboundMessage(row: OutboxRow): OutboundMessage {
  return {
    title: row.payload.title ?? "Notificacao ONEmonday",
    body: row.payload.body ?? "",
    target: row.target ?? undefined,
    url: row.payload.url,
    eventType: row.eventType ?? undefined,
  };
}

/**
 * Dispatches a single outbox row through its channel adapter and persists the
 * outcome. Never throws — failures are recorded on the row. A row that has not
 * exhausted `MAX_ATTEMPTS` is left `pending` for a later retry.
 */
export async function dispatchOutboxRow(
  row: OutboxRow,
  ports: DispatchPorts
): Promise<DispatchOutcome> {
  const attempts = row.attempts + 1;

  if (row.channel === "in_app") {
    // in_app is the native notifications path — nothing to dispatch here.
    await ports.markOutbox(row.id, { status: "sent", attempts });
    return {
      id: row.id,
      status: "sent",
      result: { ok: true, noop: true },
    };
  }

  const credential = await ports.loadCredential(row.channel, row.sectorId);
  if (!credential) {
    // No credential row at all — treat as a soft no-op so dev never breaks.
    await ports.markOutbox(row.id, {
      status: "sent",
      attempts,
      error: "Canal nao configurado (sem credencial)",
    });
    return {
      id: row.id,
      status: "sent",
      result: { ok: true, noop: true },
    };
  }

  let result: SendResult;
  try {
    const adapter = resolveChannel(row.channel, {
      secret: credential.secret,
      metadata: credential.metadata,
    });
    result = await adapter.send(toOutboundMessage(row));
  } catch (err) {
    result = {
      ok: false,
      error: err instanceof Error ? err.message : "Erro de dispatch",
    };
  }

  if (result.ok) {
    await ports.markOutbox(row.id, {
      status: "sent",
      attempts,
      error: null,
      providerRef: result.providerRef ?? null,
    });
    return { id: row.id, status: "sent", result };
  }

  // Failure: exhausted -> failed; otherwise leave pending for a retry.
  const status = attempts >= MAX_ATTEMPTS ? "failed" : "pending";
  await ports.markOutbox(row.id, {
    status,
    attempts,
    error: result.error ?? "Falha desconhecida",
  });
  return { id: row.id, status, result };
}

/** Drains a batch of pending rows sequentially. Returns every outcome. */
export async function dispatchBatch(
  rows: OutboxRow[],
  ports: DispatchPorts
): Promise<DispatchOutcome[]> {
  const outcomes: DispatchOutcome[] = [];
  for (const row of rows) {
    outcomes.push(await dispatchOutboxRow(row, ports));
  }
  return outcomes;
}

export { MAX_ATTEMPTS };
