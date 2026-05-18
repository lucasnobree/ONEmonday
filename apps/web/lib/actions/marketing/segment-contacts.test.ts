import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Coverage for audience-segment contacts (Wave 5 — W2).
 *
 * `saveSegmentContacts` replaces a segment's full contact list and must
 * de-duplicate addresses case-insensitively before writing — the DB unique
 * index is `(segment_id, lower(email))`, so a duplicate would otherwise abort
 * the whole insert.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/permissions/engine", () => ({
  getUserPermissions: async () => ({}),
  hasPermission: () => true,
}));

/** Tables/ops the supabase stub recorded. */
const writes: { table: string; op: string; row: unknown }[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from(table: string) {
      if (table === "marketing_audience_segments") {
        const builder: Record<string, unknown> = {
          select: () => builder,
          eq: () => builder,
          single: () => Promise.resolve({ data: { sector_id: "s1" } }),
        };
        return builder;
      }
      if (table === "marketing_segment_contacts") {
        return {
          delete: () => ({
            eq: () => {
              writes.push({ table, op: "delete", row: null });
              return Promise.resolve({ error: null });
            },
          }),
          insert: (row: unknown) => {
            writes.push({ table, op: "insert", row });
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { saveSegmentContacts } from "./segment-contacts";

const SEGMENT_ID = "0a791c8d-82f4-4566-9a89-c89536aa7a7c";

describe("saveSegmentContacts", () => {
  beforeEach(() => {
    writes.length = 0;
  });

  it("de-duplicates addresses case-insensitively before inserting", async () => {
    const result = await saveSegmentContacts({
      segmentId: SEGMENT_ID,
      contacts: [
        { email: "A@x.com", name: "A" },
        { email: "a@x.com", name: "A again" },
        { email: "b@x.com" },
      ],
    });
    expect(result.count).toBe(2);

    const insert = writes.find((w) => w.op === "insert");
    expect(insert?.row).toHaveLength(2);
    // Last-write-wins on the duplicate.
    expect(insert?.row).toEqual([
      expect.objectContaining({ email: "a@x.com", name: "A again" }),
      expect.objectContaining({ email: "b@x.com", name: null }),
    ]);
  });

  it("replaces the existing list (delete then insert)", async () => {
    await saveSegmentContacts({
      segmentId: SEGMENT_ID,
      contacts: [{ email: "only@x.com" }],
    });
    expect(writes.map((w) => w.op)).toEqual(["delete", "insert"]);
  });

  it("deletes but never inserts when given an empty list", async () => {
    const result = await saveSegmentContacts({
      segmentId: SEGMENT_ID,
      contacts: [],
    });
    expect(result.count).toBe(0);
    expect(writes.map((w) => w.op)).toEqual(["delete"]);
  });

  it("rejects an invalid e-mail via the schema", async () => {
    const result = await saveSegmentContacts({
      segmentId: SEGMENT_ID,
      contacts: [{ email: "not-an-email" }],
    });
    expect(result.error).toBeDefined();
    expect(writes).toEqual([]);
  });
});
