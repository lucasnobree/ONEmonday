import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runRenewalScanWithClient } from "./renewal-worker";
import type { RenewalCandidate } from "./renewal-notice";

/** A renewal candidate row with sensible defaults. */
function candidate(over: Partial<RenewalCandidate> = {}): RenewalCandidate {
  return {
    contract_id: "c1",
    sector_id: "s1",
    title: "Contrato",
    counterparty: "Acme",
    owner_id: "owner-1",
    created_by: "creator-1",
    expiry_date: "2026-06-01",
    notice_period_days: 30,
    days_until_expiry: 10,
    ...over,
  };
}

/**
 * Builds a mock Supabase client. `rpcRows` is what the RPC returns; `routes`
 * is the notification_channel_routes result. All writes are captured.
 */
function makeClient(opts: {
  rpcRows?: RenewalCandidate[];
  rpcError?: string;
  routes?: { channel: string; sector_id: string | null }[];
}) {
  const inserts: Record<string, unknown[]> = {};
  const updates: { table: string; values: unknown; id: unknown }[] = [];

  const client = {
    rpc: vi.fn(async (name: string) => {
      expect(name).toBe("get_contracts_needing_renewal_notice");
      if (opts.rpcError) return { data: null, error: { message: opts.rpcError } };
      return { data: opts.rpcRows ?? [], error: null };
    }),
    from: vi.fn((table: string) => ({
      // route lookup chain: .select().eq().eq()
      select: () => ({
        eq: () => ({
          eq: async () => ({ data: opts.routes ?? [], error: null }),
        }),
      }),
      insert: async (rows: unknown) => {
        inserts[table] = (inserts[table] ?? []).concat(rows);
        return { error: null };
      },
      update: (values: unknown) => ({
        eq: async (_col: string, id: unknown) => {
          updates.push({ table, values, id });
          return { error: null };
        },
      }),
    })),
  } as unknown as SupabaseClient;

  return { client, inserts, updates };
}

describe("runRenewalScanWithClient", () => {
  it("returns the query error when the RPC fails", async () => {
    const { client } = makeClient({ rpcError: "boom" });
    const result = await runRenewalScanWithClient(client);
    expect(result).toEqual({ error: "boom" });
  });

  it("is a no-op when no contract needs a notice", async () => {
    const { client, updates } = makeClient({ rpcRows: [] });
    const result = await runRenewalScanWithClient(client);
    expect(result).toEqual({
      scanned: 0,
      notified: 0,
      inAppCreated: 0,
      outboxEnqueued: 0,
    });
    expect(updates).toHaveLength(0);
  });

  it("creates an in-app notification and stamps the contract", async () => {
    const { client, inserts, updates } = makeClient({
      rpcRows: [candidate()],
      routes: [],
    });
    const result = await runRenewalScanWithClient(client);

    expect(result).toMatchObject({
      scanned: 1,
      notified: 1,
      inAppCreated: 1,
      outboxEnqueued: 0,
    });
    // One in-app notification row addressed to the owner.
    expect(inserts["notifications"]).toHaveLength(1);
    expect(inserts["notifications"][0]).toMatchObject({
      user_id: "owner-1",
      type: "contract_renewal",
      resource_type: "legal_contract",
      resource_id: "c1",
    });
    // The contract was stamped so it is not re-alerted.
    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe("legal_contracts");
    expect(updates[0].values).toHaveProperty("renewal_notified_at");
  });

  it("skips the in-app row when the contract has no owner but still stamps it", async () => {
    const { client, inserts, updates } = makeClient({
      rpcRows: [candidate({ owner_id: null })],
      routes: [],
    });
    const result = await runRenewalScanWithClient(client);

    expect(result).toMatchObject({ inAppCreated: 0, notified: 1 });
    expect(inserts["notifications"]).toBeUndefined();
    expect(updates).toHaveLength(1);
  });

  it("enqueues an outbox row per external channel routed for the event", async () => {
    const { client, inserts } = makeClient({
      rpcRows: [candidate()],
      routes: [
        { channel: "teams", sector_id: null },
        { channel: "whatsapp", sector_id: "s1" },
        // in_app is the native path — never enqueued externally.
        { channel: "in_app", sector_id: null },
        // a route for a different sector is ignored.
        { channel: "teams", sector_id: "other-sector" },
      ],
    });
    const result = await runRenewalScanWithClient(client);

    expect(result).toMatchObject({ outboxEnqueued: 2 });
    expect(inserts["notification_outbox"]).toHaveLength(2);
    const channels = (inserts["notification_outbox"] as {
      channel: string;
    }[]).map((r) => r.channel);
    expect(channels).toContain("teams");
    expect(channels).toContain("whatsapp");
    expect(channels).not.toContain("in_app");
  });

  it("attributes an ownerless outbox row to the contract creator", async () => {
    const { client, inserts } = makeClient({
      rpcRows: [candidate({ owner_id: null, created_by: "creator-9" })],
      routes: [{ channel: "teams", sector_id: null }],
    });
    await runRenewalScanWithClient(client);

    expect(inserts["notification_outbox"][0]).toMatchObject({
      created_by: "creator-9",
    });
  });
});
