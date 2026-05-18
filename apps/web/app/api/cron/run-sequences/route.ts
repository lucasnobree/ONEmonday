/**
 * Internal cron-trigger route — marketing-sequence runner.
 *
 * A `pg_cron` job (see migration 00137) `POST`s here on a longer interval
 * (sequences advance in minutes/days, not seconds) to run due automation-
 * sequence steps automatically. This is the scheduled counterpart of the
 * manual "Processar agora" button / the `runDueSequenceSteps` server action —
 * both share the SAME pure `evaluateStep` core, so automatic and manual
 * triggers advance enrollments identically. The manual path is untouched.
 *
 * This route is NOT publicly callable: it runs the privileged sequence worker
 * with the service-role Supabase client (RLS-bypassing). Every request must
 * carry the shared `CRON_SECRET` — a request without it, or with a wrong one,
 * gets 401. With no service-role key the route degrades to a safe 503.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/supabase/service";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runDueSequenceStepsWithClient } from "@/lib/marketing/sequence-worker";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!hasServiceRoleKey()) {
    // No service-role key configured — the worker cannot bypass RLS. Degrade
    // safely so a misconfigured deploy never crashes the cron job.
    return NextResponse.json(
      { error: "service_unavailable" },
      { status: 503 }
    );
  }

  const result = await runDueSequenceStepsWithClient(createServiceClient());
  if ("error" in result) {
    return NextResponse.json({ ok: false, error: result.error }, {
      status: 500,
    });
  }

  return NextResponse.json({ ok: true, ...result });
}
