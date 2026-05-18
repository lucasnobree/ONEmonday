import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the service client + the worker so the route is tested in isolation.
const hasServiceRoleKey = vi.fn(() => true);
const createServiceClient = vi.fn(() => ({}) as unknown);
const runDueSequenceStepsWithClient = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  hasServiceRoleKey: () => hasServiceRoleKey(),
  createServiceClient: () => createServiceClient(),
}));
vi.mock("@/lib/marketing/sequence-worker", () => ({
  runDueSequenceStepsWithClient: (c: unknown) =>
    runDueSequenceStepsWithClient(c),
}));

import { POST } from "./route";

const ORIGINAL_SECRET = process.env.CRON_SECRET;

/** Builds a POST request with the given headers. */
function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/cron/run-sequences", {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  hasServiceRoleKey.mockReturnValue(true);
  runDueSequenceStepsWithClient.mockResolvedValue({
    processed: 5,
    advanced: 4,
    emailsSent: 2,
    skippedSteps: 0,
    completed: 1,
    sendFailures: 0,
  });
  process.env.CRON_SECRET = "the-secret";
});

afterEach(() => {
  vi.clearAllMocks();
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
});

describe("POST /api/cron/run-sequences", () => {
  it("returns 401 without a secret and never runs the worker", async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(runDueSequenceStepsWithClient).not.toHaveBeenCalled();
  });

  it("returns 401 with a wrong secret", async () => {
    const res = await POST(req({ "x-cron-secret": "nope" }));
    expect(res.status).toBe(401);
    expect(runDueSequenceStepsWithClient).not.toHaveBeenCalled();
  });

  it("returns 503 when the service-role key is unconfigured", async () => {
    hasServiceRoleKey.mockReturnValue(false);
    const res = await POST(req({ authorization: "Bearer the-secret" }));
    expect(res.status).toBe(503);
    expect(runDueSequenceStepsWithClient).not.toHaveBeenCalled();
  });

  it("runs the worker and returns 200 with the right secret", async () => {
    const res = await POST(req({ authorization: "Bearer the-secret" }));
    expect(res.status).toBe(200);
    expect(runDueSequenceStepsWithClient).toHaveBeenCalledTimes(1);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      processed: 5,
      advanced: 4,
      emailsSent: 2,
      skippedSteps: 0,
      completed: 1,
      sendFailures: 0,
    });
  });

  it("returns 500 when the worker reports an error", async () => {
    runDueSequenceStepsWithClient.mockResolvedValue({ error: "db down" });
    const res = await POST(req({ authorization: "Bearer the-secret" }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "db down" });
  });
});
