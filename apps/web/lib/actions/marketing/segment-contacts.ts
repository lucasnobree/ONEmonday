"use server";

/**
 * Audience-segment contact server actions — Wave 5 (W2).
 *
 * A `marketing_audience_segments` row gains a real recipient list via
 * `marketing_segment_contacts`. These actions let the segment dialog manage
 * that list, and `resolveSegmentRecipients` is the primitive the e-mail send
 * path uses to turn an attached `segment_id` into actual addresses.
 *
 * Managing a segment's contacts reuses the `audience_segment` permission
 * resource — it is the same capability as editing the segment itself.
 */
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { saveSegmentContactsSchema } from "@/lib/validations/marketing";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** A resolved recipient — the shape the e-mail send path consumes. */
export interface ResolvedRecipient {
  email: string;
  name?: string;
}

/**
 * Replaces the full contact list of a segment in one call (the segment dialog
 * sends the whole edited list). Duplicate addresses within the payload are
 * de-duplicated case-insensitively, last-write-wins.
 */
export async function saveSegmentContacts(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = saveSegmentContactsSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: segment } = await supabase
    .from("marketing_audience_segments")
    .select("sector_id")
    .eq("id", parsed.data.segmentId)
    .single();
  if (!segment) return { error: "Audiência não encontrada" };

  const perms = await getUserPermissions(user.id);
  if (
    !hasPermission(perms, segment.sector_id, "audience_segment", "update")
  ) {
    return { error: "Sem permissao" };
  }

  // De-duplicate by lower-cased email — last occurrence wins.
  const byEmail = new Map<string, { email: string; name: string | null }>();
  for (const c of parsed.data.contacts) {
    byEmail.set(c.email.trim().toLowerCase(), {
      email: c.email.trim(),
      name: c.name?.trim() || null,
    });
  }

  // Replace strategy: delete the existing rows, insert the new set.
  const { error: delErr } = await supabase
    .from("marketing_segment_contacts")
    .delete()
    .eq("segment_id", parsed.data.segmentId);
  if (delErr) return { error: delErr.message };

  if (byEmail.size > 0) {
    const rows = [...byEmail.values()].map((c) => ({
      segment_id: parsed.data.segmentId,
      sector_id: segment.sector_id,
      email: c.email,
      name: c.name,
      created_by: user.id,
    }));
    const { error: insErr } = await supabase
      .from("marketing_segment_contacts")
      .insert(rows);
    if (insErr) return { error: insErr.message };
  }

  revalidatePath("/marketing");
  revalidatePath("/marketing/email");
  return { success: true, count: byEmail.size };
}

/**
 * Resolves the recipient list for an audience segment from
 * `marketing_segment_contacts`. Returns an empty array when the segment has no
 * contacts. RLS scopes the read to the caller's sectors.
 */
export async function resolveSegmentRecipients(
  segmentId: string
): Promise<{ recipients: ResolvedRecipient[]; error?: string }> {
  const parsed = z.string().uuid().safeParse(segmentId);
  if (!parsed.success) return { recipients: [], error: "ID inválido" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_segment_contacts")
    .select("email, name")
    .eq("segment_id", segmentId)
    .order("email", { ascending: true });
  if (error) return { recipients: [], error: error.message };

  return {
    recipients: (data ?? []).map((c) => ({
      email: c.email,
      name: c.name ?? undefined,
    })),
  };
}
