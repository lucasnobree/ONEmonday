/**
 * Internal cron-trigger route — contract-renewal notification scan.
 *
 * A `pg_cron` job (see migration 00179) `POST`s here once a day to scan for
 * contracts that have entered the termination-notice window and dispatch a
 * renewal alert for each — an in-app notification to the owner plus an outbox
 * row per externally-routed channel. Each contract is alerted at most once
 * (tracked by `legal_contracts.renewal_notified_at`), so re-running is safe.
 *
 * This route is NOT publicly callable: it runs the privileged renewal worker
 * with the service-role Supabase client (RLS-bypassing) so the scan covers
 * every sector. Every request must carry the shared `CRON_SECRET`; a request
 * without it, or with a wrong one, gets 401. With no service-role key the
 * route degrades to a safe 503 instead of crashing, exactly like the other
 * cron routes.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runRenewalScanWithClient } from "@/lib/legal/renewal-worker";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      { error: "service_unavailable" },
      { status: 503 }
    );
  }

  const result = await runRenewalScanWithClient(createServiceClient());
  if ("error" in result) {
    return NextResponse.json({ ok: false, error: result.error }, {
      status: 500,
    });
  }

  return NextResponse.json({ ok: true, ...result });
}
