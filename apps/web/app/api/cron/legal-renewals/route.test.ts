import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the service client + the worker so the route is tested in isolation.
const hasServiceRoleKey = vi.fn(() => true);
const createServiceClient = vi.fn(() => ({}) as unknown);
const runRenewalScanWithClient = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  hasServiceRoleKey: () => hasServiceRoleKey(),
  createServiceClient: () => createServiceClient(),
}));
vi.mock("@/lib/legal/renewal-worker", () => ({
  runRenewalScanWithClient: (c: unknown) => runRenewalScanWithClient(c),
}));

import { POST } from "./route";

const ORIGINAL_SECRET = process.env.CRON_SECRET;

function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/cron/legal-renewals", {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  hasServiceRoleKey.mockReturnValue(true);
  runRenewalScanWithClient.mockResolvedValue({
    scanned: 2,
    notified: 2,
    inAppCreated: 2,
    outboxEnqueued: 1,
  });
  process.env.CRON_SECRET = "the-secret";
});

afterEach(() => {
  vi.clearAllMocks();
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
});

describe("POST /api/cron/legal-renewals", () => {
  it("returns 401 without a secret and never runs the worker", async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(runRenewalScanWithClient).not.toHaveBeenCalled();
  });

  it("returns 401 with a wrong secret", async () => {
    const res = await POST(req({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
    expect(runRenewalScanWithClient).not.toHaveBeenCalled();
  });

  it("returns 503 when no service-role key is configured", async () => {
    hasServiceRoleKey.mockReturnValue(false);
    const res = await POST(req({ authorization: "Bearer the-secret" }));
    expect(res.status).toBe(503);
    expect(runRenewalScanWithClient).not.toHaveBeenCalled();
  });

  it("runs the worker and returns the scan summary on success", async () => {
    const res = await POST(req({ authorization: "Bearer the-secret" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      scanned: 2,
      notified: 2,
      outboxEnqueued: 1,
    });
    expect(runRenewalScanWithClient).toHaveBeenCalledOnce();
  });

  it("accepts the secret via the x-cron-secret header", async () => {
    const res = await POST(req({ "x-cron-secret": "the-secret" }));
    expect(res.status).toBe(200);
  });

  it("returns 500 when the worker reports an error", async () => {
    runRenewalScanWithClient.mockResolvedValue({ error: "rpc failed" });
    const res = await POST(req({ authorization: "Bearer the-secret" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "rpc failed" });
  });
});
