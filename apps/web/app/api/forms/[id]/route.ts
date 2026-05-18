/**
 * Public lead-capture endpoint — UNAUTHENTICATED.
 *
 * `[id]` is a lead-capture form's unguessable `public_token` (migration 00128).
 *
 * GET  — returns the published form definition (name, fields, success message)
 *        so a public page can render the field list.
 * POST — accepts a visitor's submission and creates ONE `crm_leads` row.
 *
 * This route is the seam that lets the company stop depending on RD Station
 * for inbound leads. Because it is public it is hardened on several layers:
 *
 *   * It uses the ANON Supabase client — every query stays inside RLS. The
 *     `anon` policies in migration 00128 let it read only a published form and
 *     INSERT only a fresh `crm_leads` row bound to that form. It can do nothing
 *     else — no service-role key, no RLS bypass.
 *   * It writes ONLY `crm_leads`; status is forced to 'new', score is computed
 *     server-side, no conversion/owner fields are ever set by the public path.
 *   * A per-IP, fixed-window in-memory rate limit blunts a naive flood.
 *   * A hidden honeypot field (`website`) silently absorbs trivial bots.
 *   * Submitted values are validated against the form's own field definition;
 *     unknown keys are dropped, so a caller cannot inject arbitrary payload.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { publicLeadSubmissionSchema } from "@/lib/validations/crm";
import type { LeadFormField } from "@/lib/validations/crm";
import {
  validateSubmission,
  mapSubmissionToLead,
  type LeadFormDefinition,
} from "@/lib/crm/lead-forms";
import { scoreLead } from "@/lib/crm/lead-scoring";
import { checkRateLimit } from "@/lib/crm/lead-rate-limit";

export const dynamic = "force-dynamic";

/** Shape of a `crm_lead_forms` row this route reads. */
interface FormRow {
  id: string;
  sector_id: string;
  name: string;
  description: string | null;
  source: string;
  success_message: string;
  fields: LeadFormField[];
}

/** Resolves the caller's IP for rate limiting, best-effort. */
function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Loads a published, active form by its public token. */
async function loadForm(token: string): Promise<FormRow | null> {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("crm_lead_forms")
    .select("id, sector_id, name, description, source, success_message, fields")
    .eq("public_token", token)
    .eq("is_active", true)
    .eq("is_published", true)
    .maybeSingle<FormRow>();
  return data ?? null;
}

/** GET — public form definition for rendering the capture page. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: token } = await params;
  const form = await loadForm(token);
  if (!form) {
    return NextResponse.json({ error: "Formulário não encontrado" }, { status: 404 });
  }
  return NextResponse.json({
    name: form.name,
    description: form.description,
    successMessage: form.success_message,
    fields: form.fields,
  });
}

/** POST — accept a public submission, create a `crm_leads` row. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: token } = await params;

  // Rate limit per IP + form so one form being flooded does not starve others.
  const limit = checkRateLimit(`lead-form:${clientIp(request)}:${token}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em instantes." },
      { status: 429 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const parsed = publicLeadSubmissionSchema.safeParse({ ...(raw as object), formToken: token });
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  // Honeypot: a hidden field a human never fills. A non-empty value = a bot.
  // Respond 200 so the bot cannot distinguish a rejection from a success.
  if (parsed.data.website && parsed.data.website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const form = await loadForm(token);
  if (!form) {
    return NextResponse.json({ error: "Formulário não encontrado" }, { status: 404 });
  }

  const definition: LeadFormDefinition = {
    id: form.id,
    sector_id: form.sector_id,
    source: form.source,
    fields: form.fields,
  };

  // Validate the visitor's values against the form's own field list.
  const validation = validateSubmission(definition, parsed.data.values);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Verifique os campos", fields: validation.errors },
      { status: 422 }
    );
  }

  const mapped = mapSubmissionToLead(validation.values);
  // Score the lead server-side — the public path never trusts a client score.
  const { score } = scoreLead({
    name: mapped.name,
    email: mapped.email,
    phone: mapped.phone,
    company: mapped.company,
    source: form.source,
    payload: mapped.payload,
  });

  const supabase = createAnonClient();
  // The lead is written status 'new' with the server-computed score. The anon
  // RLS INSERT policy (migration 00128) pins it to this form's sector and
  // forbids any owner/conversion fields — the public path can only ever create
  // a fresh, unconverted lead.
  const { error } = await supabase.from("crm_leads").insert({
    sector_id: form.sector_id,
    form_id: form.id,
    name: mapped.name,
    email: mapped.email,
    phone: mapped.phone,
    company: mapped.company,
    source: form.source,
    payload: mapped.payload,
    status: "new",
    score,
  });

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível registrar o contato" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, message: form.success_message });
}
