"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createLeadSchema,
  updateLeadSchema,
  discardLeadSchema,
  qualifyLeadSchema,
} from "@/lib/validations/crm";
import { scoreLead } from "@/lib/crm/lead-scoring";
import { planLeadConversion } from "@/lib/crm/lead-conversion";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Lead lifecycle server actions — the CRM Leads inbox.
 *
 *  - `createLead`  — manually add a lead (scored on the way in).
 *  - `updateLead`  — triage status (new <-> working) / reassign owner.
 *  - `discardLead` — mark a lead discarded with a reason.
 *  - `qualifyLead` — convert a lead into a `crm_contacts` + `crm_deals` pair
 *    (the deal rides a `cards` row on the chosen pipeline column), and link
 *    the resulting ids back onto the lead.
 *
 * Public, unauthenticated lead *capture* lives in `app/api/forms/[id]/route.ts`.
 * Standard write path: createClient → auth.getUser → Zod safeParse →
 * permission check → DB write → revalidatePath.
 */

export async function createLead(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createLeadSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "lead", "create")) {
    return { error: "Sem permissao" };
  }

  const payload = parsed.data.payload ?? {};
  // Score the lead at creation time from its attributes.
  const { score } = scoreLead({
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    company: parsed.data.company || null,
    source: parsed.data.source,
    payload,
  });

  const { data: lead, error } = await supabase
    .from("crm_leads")
    .insert({
      sector_id: parsed.data.sectorId,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      company: parsed.data.company || null,
      source: parsed.data.source,
      payload,
      score,
      owner_id: parsed.data.ownerId || user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/crm/leads");
  return { data: lead };
}

export async function updateLead(formData: unknown) {
  const parsed = updateLeadSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: lead } = await supabase
    .from("crm_leads")
    .select("sector_id, status")
    .eq("id", parsed.data.id)
    .single();

  if (!lead) return { error: "Lead nao encontrado" };

  // qualified / discarded are terminal — they only change via qualify/discard.
  if (lead.status === "qualified" || lead.status === "discarded") {
    return { error: "Lead ja foi finalizado" };
  }

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, lead.sector_id, "lead", "update")) {
    return { error: "Sem permissao" };
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.ownerId !== undefined) update.owner_id = parsed.data.ownerId;
  if (Object.keys(update).length === 0) return { error: "Nada a atualizar" };

  const { error } = await supabase
    .from("crm_leads")
    .update(update)
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/crm/leads");
  return { success: true };
}

export async function discardLead(formData: unknown) {
  const parsed = discardLeadSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: lead } = await supabase
    .from("crm_leads")
    .select("sector_id, status")
    .eq("id", parsed.data.id)
    .single();

  if (!lead) return { error: "Lead nao encontrado" };
  if (lead.status === "qualified") {
    return { error: "Lead ja foi qualificado" };
  }

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, lead.sector_id, "lead", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("crm_leads")
    .update({ status: "discarded", discard_reason: parsed.data.reason })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/crm/leads");
  return { success: true };
}

/**
 * Reopen a discarded lead back to 'working' (a mis-discard recovery path).
 */
export async function reopenLead(leadId: string) {
  const parsed = z.string().uuid().safeParse(leadId);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: lead } = await supabase
    .from("crm_leads")
    .select("sector_id, status")
    .eq("id", leadId)
    .single();

  if (!lead) return { error: "Lead nao encontrado" };
  if (lead.status !== "discarded") {
    return { error: "Apenas leads descartados podem ser reabertos" };
  }

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, lead.sector_id, "lead", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("crm_leads")
    .update({ status: "working", discard_reason: null })
    .eq("id", leadId);

  if (error) return { error: error.message };

  revalidatePath("/crm/leads");
  return { success: true };
}

/**
 * Qualify a lead — convert it into the real CRM entities.
 *
 * Steps: optional `crm_companies` row → `crm_contacts` row → a `cards` row on
 * the chosen pipeline column → a `crm_deals` row 1:1 with that card → mark the
 * lead `qualified` and stamp the new deal/contact ids onto it. The lead's
 * `crm_leads` CHECK constraint enforces that a `qualified` row carries its
 * `converted_deal_id`.
 */
export async function qualifyLead(formData: unknown) {
  const parsed = qualifyLeadSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: lead } = await supabase
    .from("crm_leads")
    .select(
      "id, sector_id, name, email, phone, company, source, score, status"
    )
    .eq("id", parsed.data.id)
    .single();

  if (!lead) return { error: "Lead nao encontrado" };
  if (lead.status === "qualified") {
    return { error: "Lead ja foi qualificado" };
  }
  if (lead.status === "discarded") {
    return { error: "Reabra o lead antes de qualifica-lo" };
  }

  const perms = await getUserPermissions(user.id);
  // Qualifying creates a deal + contact — the user needs both rights.
  if (
    !hasPermission(perms, lead.sector_id, "lead", "update") ||
    !hasPermission(perms, lead.sector_id, "deal", "create") ||
    !hasPermission(perms, lead.sector_id, "contact", "create")
  ) {
    return { error: "Sem permissao" };
  }

  // Confirm the target column belongs to the chosen board (and exists).
  const { data: column } = await supabase
    .from("board_columns")
    .select("id, board_id")
    .eq("id", parsed.data.columnId)
    .eq("board_id", parsed.data.boardId)
    .single();

  if (!column) return { error: "Coluna do pipeline invalida" };

  const plan = planLeadConversion(lead, parsed.data.value ?? null, parsed.data.currency);

  // 1. Company (optional — only when the lead named one).
  let companyId: string | null = null;
  if (plan.company) {
    const { data: company, error: companyError } = await supabase
      .from("crm_companies")
      .insert({ ...plan.company, owner_id: parsed.data.ownerId || user.id })
      .select("id")
      .single();
    if (companyError) return { error: companyError.message };
    companyId = company.id;
  }

  // 2. Contact.
  const { data: contact, error: contactError } = await supabase
    .from("crm_contacts")
    .insert({
      ...plan.contact,
      company_id: companyId,
      owner_id: parsed.data.ownerId || user.id,
    })
    .select("id")
    .single();
  if (contactError) return { error: contactError.message };

  // 3. Card on the chosen pipeline column (appended to the end).
  const { data: maxPos } = await supabase
    .from("cards")
    .select("position")
    .eq("column_id", parsed.data.columnId)
    .eq("is_active", true)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .insert({
      title: plan.card.title,
      priority: plan.card.priority,
      column_id: parsed.data.columnId,
      board_id: parsed.data.boardId,
      sector_id: plan.card.sector_id,
      created_by: user.id,
      position: (maxPos?.position ?? -1) + 1,
    })
    .select("id")
    .single();
  if (cardError) return { error: cardError.message };

  // 4. Deal (1:1 with the card).
  const { data: deal, error: dealError } = await supabase
    .from("crm_deals")
    .insert({
      card_id: card.id,
      sector_id: plan.deal.sector_id,
      company_id: companyId,
      contact_id: contact.id,
      owner_id: parsed.data.ownerId || user.id,
      value: plan.deal.value,
      currency: plan.deal.currency,
      source: plan.deal.source,
      win_probability: plan.deal.win_probability,
    })
    .select("id")
    .single();
  if (dealError) return { error: dealError.message };

  // 5. Mark the lead qualified and link the conversion.
  const { error: leadError } = await supabase
    .from("crm_leads")
    .update({
      status: "qualified",
      converted_deal_id: deal.id,
      converted_contact_id: contact.id,
      converted_at: new Date().toISOString(),
      owner_id: parsed.data.ownerId || user.id,
    })
    .eq("id", lead.id);
  if (leadError) return { error: leadError.message };

  await supabase.from("card_activity_log").insert({
    card_id: card.id,
    user_id: user.id,
    action: "card_created",
    metadata: { title: plan.card.title, deal_id: deal.id, lead_id: lead.id },
  });

  revalidatePath("/crm/leads");
  revalidatePath("/crm/pipeline");
  return { data: { dealId: deal.id, contactId: contact.id, companyId } };
}
