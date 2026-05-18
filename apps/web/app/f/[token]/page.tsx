import { notFound } from "next/navigation";
import { createAnonClient } from "@/lib/supabase/anon";
import type { LeadFormField } from "@/lib/validations/crm";
import { PublicLeadForm } from "@/components/crm/public-lead-form";

/**
 * Public, hosted lead-capture page — `/f/<public_token>`.
 *
 * This page is UNAUTHENTICATED (whitelisted in the middleware). It renders a
 * sector's lead-capture form from its definition; the actual submission posts
 * to `/api/forms/<token>` which creates the `crm_leads` row inside RLS.
 *
 * Deferred: this is a focused field-list form, NOT a drag-and-drop
 * landing-page builder (see migration-comercial.md §5).
 */

interface PublicFormPageProps {
  params: Promise<{ token: string }>;
}

interface FormRow {
  name: string;
  description: string | null;
  fields: LeadFormField[];
}

export default async function PublicFormPage({ params }: PublicFormPageProps) {
  const { token } = await params;

  const supabase = createAnonClient();
  const { data } = await supabase
    .from("crm_lead_forms")
    .select("name, description, fields")
    .eq("public_token", token)
    .eq("is_active", true)
    .eq("is_published", true)
    .maybeSingle<FormRow>();

  if (!data) notFound();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-bold">{data.name}</h1>
        {data.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {data.description}
          </p>
        )}
        <div className="mt-6">
          <PublicLeadForm token={token} fields={data.fields} />
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Powered by ONEmonday
      </p>
    </main>
  );
}
