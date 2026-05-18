import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runOutboxDispatchWithClient } from "./dispatch-worker";

/** A pending in_app outbox row — dispatched without a credential lookup. */
interface FakeOutboxRow {
  id: string;
  sector_id: string | null;
  channel: string;
  target: string | null;
  event_type: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  status: string;
}

/**
 * A minimal chainable Supabase stand-in for the dispatch worker. It serves a
 * fixed set of `notification_outbox` rows for the pending-rows SELECT and
 * records every `update().eq()` so the test can assert the terminal state.
 */
function fakeClient(
  rows: FakeOutboxRow[],
  opts: { selectError?: string } = {}
): {
  client: SupabaseClient;
  updates: { id: string; patch: Record<string, unknown> }[];
} {
  const updates: { id: string; patch: Record<string, unknown> }[] = [];

  const selectChain = {
    eq: () => selectChain,
    order: () => selectChain,
    limit: () =>
      Promise.resolve(
        opts.selectError
          ? { data: null, error: { message: opts.selectError } }
          : { data: rows, error: null }
      ),
  };

  const client = {
    from(table: string) {
      if (table !== "notification_outbox") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select: () => selectChain,
        update(patch: Record<string, unknown>) {
          return {
            eq: (_col: string, id: string) => {
              updates.push({ id, patch });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, updates };
}

function inAppRow(id: string): FakeOutboxRow {
  return {
    id,
    sector_id: null,
    channel: "in_app",
    target: null,
    event_type: "card_overdue",
    payload: { title: "T", body: "B" },
    attempts: 0,
    status: "pending",
  };
}

describe("runOutboxDispatchWithClient", () => {
  it("returns a zeroed summary when the outbox is empty", async () => {
    const { client } = fakeClient([]);
    const result = await runOutboxDispatchWithClient(client);
    expect(result).toEqual({
      processed: 0,
      sent: 0,
      failed: 0,
      retrying: 0,
    });
  });

  it("dispatches pending rows and reports them sent", async () => {
    const { client, updates } = fakeClient([inAppRow("r1"), inAppRow("r2")]);
    const result = await runOutboxDispatchWithClient(client);
    expect(result).toEqual({
      processed: 2,
      sent: 2,
      failed: 0,
      retrying: 0,
    });
    // Each row was marked sent with attempts incremented.
    expect(updates).toHaveLength(2);
    expect(updates[0].patch.status).toBe("sent");
    expect(updates[0].patch.attempts).toBe(1);
    expect(updates[0].patch.sent_at).toBeTypeOf("string");
  });

  it("surfaces a query error instead of throwing", async () => {
    const { client } = fakeClient([], { selectError: "boom" });
    const result = await runOutboxDispatchWithClient(client);
    expect(result).toEqual({ error: "boom" });
  });
});
