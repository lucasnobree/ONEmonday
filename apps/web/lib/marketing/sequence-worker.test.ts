import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runDueSequenceStepsWithClient } from "./sequence-worker";

interface FakeEnrollment {
  id: string;
  sequence_id: string;
  recipient_email: string;
  recipient_name: string | null;
  current_step: number;
  status: "active" | "completed" | "cancelled";
  next_run_at: string;
}

interface FakeStep {
  step_order: number;
  step_type: "wait" | "send_email";
  wait_days: number;
  email_campaign_id: string | null;
}

/**
 * A minimal chainable Supabase stand-in for the sequence worker. Covers the
 * three read paths (`enrollments`, `sequences`, `steps`) and records every
 * enrollment update so the test can assert the advanced state. The test
 * fixtures use `wait` steps only, so the ESP send path is never exercised.
 */
function fakeClient(opts: {
  enrollments: FakeEnrollment[];
  steps: FakeStep[];
  sequenceActive?: boolean;
  enrollmentsError?: string;
}): {
  client: SupabaseClient;
  updates: { id: string; patch: Record<string, unknown> }[];
} {
  const updates: { id: string; patch: Record<string, unknown> }[] = [];
  const sequenceActive = opts.sequenceActive ?? true;

  const client = {
    from(table: string) {
      if (table === "marketing_sequence_enrollments") {
        const chain = {
          eq: () => chain,
          lte: () => chain,
          order: () => chain,
          limit: () =>
            Promise.resolve(
              opts.enrollmentsError
                ? { data: null, error: { message: opts.enrollmentsError } }
                : { data: opts.enrollments, error: null }
            ),
        };
        return {
          select: () => chain,
          update(patch: Record<string, unknown>) {
            return {
              eq: (_col: string, id: string) => {
                updates.push({ id, patch });
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      if (table === "marketing_sequences") {
        const chain = {
          eq: () => chain,
          single: () =>
            Promise.resolve({
              data: { status: "active", is_active: sequenceActive },
              error: null,
            }),
        };
        return { select: () => chain };
      }
      if (table === "marketing_sequence_steps") {
        const chain = {
          eq: () => chain,
          order: () =>
            Promise.resolve({ data: opts.steps, error: null }),
        };
        return { select: () => chain };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;

  return { client, updates };
}

const pastIso = new Date(Date.now() - 60_000).toISOString();

describe("runDueSequenceStepsWithClient", () => {
  it("returns a zeroed summary when nothing is due", async () => {
    const { client } = fakeClient({ enrollments: [], steps: [] });
    const result = await runDueSequenceStepsWithClient(client);
    expect(result).toEqual({
      processed: 0,
      advanced: 0,
      emailsSent: 0,
      skippedSteps: 0,
      completed: 0,
      sendFailures: 0,
    });
  });

  it("advances a due enrollment over a wait step", async () => {
    const { client, updates } = fakeClient({
      enrollments: [
        {
          id: "e1",
          sequence_id: "s1",
          recipient_email: "a@b.com",
          recipient_name: null,
          current_step: 0,
          status: "active",
          next_run_at: pastIso,
        },
      ],
      steps: [
        { step_order: 0, step_type: "wait", wait_days: 3, email_campaign_id: null },
        { step_order: 1, step_type: "wait", wait_days: 1, email_campaign_id: null },
      ],
    });
    const result = await runDueSequenceStepsWithClient(client);
    expect(result).toMatchObject({ processed: 1, advanced: 1 });
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("e1");
    expect(updates[0].patch.current_step).toBe(1);
    expect(updates[0].patch.status).toBe("active");
  });

  it("completes an enrollment past its last step", async () => {
    const { client, updates } = fakeClient({
      enrollments: [
        {
          id: "e2",
          sequence_id: "s1",
          recipient_email: "a@b.com",
          recipient_name: null,
          current_step: 1,
          status: "active",
          next_run_at: pastIso,
        },
      ],
      steps: [
        { step_order: 0, step_type: "wait", wait_days: 1, email_campaign_id: null },
      ],
    });
    const result = await runDueSequenceStepsWithClient(client);
    expect(result).toMatchObject({ processed: 1, completed: 1 });
    expect(updates[0].patch.status).toBe("completed");
    expect(updates[0].patch.completed_at).toBeTypeOf("string");
  });

  it("skips enrollments of an inactive parent sequence", async () => {
    const { client, updates } = fakeClient({
      sequenceActive: false,
      enrollments: [
        {
          id: "e3",
          sequence_id: "s1",
          recipient_email: "a@b.com",
          recipient_name: null,
          current_step: 0,
          status: "active",
          next_run_at: pastIso,
        },
      ],
      steps: [
        { step_order: 0, step_type: "wait", wait_days: 1, email_campaign_id: null },
      ],
    });
    const result = await runDueSequenceStepsWithClient(client);
    expect(result).toMatchObject({ processed: 1, advanced: 0 });
    expect(updates).toHaveLength(0);
  });

  it("surfaces a query error instead of throwing", async () => {
    const { client } = fakeClient({
      enrollments: [],
      steps: [],
      enrollmentsError: "db down",
    });
    const result = await runDueSequenceStepsWithClient(client);
    expect(result).toEqual({ error: "db down" });
  });
});
