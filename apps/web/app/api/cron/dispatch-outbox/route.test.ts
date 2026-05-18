import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the service client + the worker so the route is tested in isolation.
const hasServiceRoleKey = vi.fn(() => true);
const createServiceClient = vi.fn(() => ({}) as unknown);
const runOutboxDispatchWithClient = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  hasServiceRoleKey: () => hasServiceRoleKey(),
  createServiceClient: () => createServiceClient(),
}));
vi.mock("@/lib/integrations/dispatch-worker", () => ({
  runOutboxDispatchWithClient: (c: unknown) => runOutboxDispatchWithClient(c),
}));

import { POST } from "./route";

const ORIGINAL_SECRET = process.env.CRON_SECRET;

/** Builds a POST request with the given headers. */
function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/cron/dispatch-outbox", {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  hasServiceRoleKey.mockReturnValue(true);
  runOutboxDispatchWithClient.mockResolvedValue({
    processed: 3,
    sent: 2,
    failed: 0,
    retrying: 1,
  });
  process.env.CRON_SECRET = "the-secret";
});

afterEach(() => {
  vi.clearAllMocks();
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
});

describe("POST /api/cron/dispatch-outbox", () => {
  it("returns 401 without a secret and never runs the worker", async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(runOutboxDispatchWithClient).not.toHaveBeenCalled();
  });

  it("returns 401 with a wrong secret", async () => {
    const res = await POST(req({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
    expect(runOutboxDispatchWithClient).not.toHaveBeenCalled();
  });

  it("returns 503 when the service-role key is unconfigured", async () => {
    hasServiceRoleKey.mockReturnValue(false);
    const res = await POST(req({ authorization: "Bearer the-secret" }));
    expect(res.status).toBe(503);
    expect(runOutboxDispatchWithClient).not.toHaveBeenCalled();
  });

  it("runs the worker and returns 200 with the right secret", async () => {
    const res = await POST(req({ authorization: "Bearer the-secret" }));
    expect(res.status).toBe(200);
    expect(runOutboxDispatchWithClient).toHaveBeenCalledTimes(1);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      processed: 3,
      sent: 2,
      failed: 0,
      retrying: 1,
    });
  });

  it("returns 500 when the worker reports an error", async () => {
    runOutboxDispatchWithClient.mockResolvedValue({ error: "boom" });
    const res = await POST(req({ authorization: "Bearer the-secret" }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "boom" });
  });
});
