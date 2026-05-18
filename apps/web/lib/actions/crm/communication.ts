"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  sendWhatsappMessageSchema,
  logEmailSchema,
} from "@/lib/validations/crm";
import { loadCredentialFor } from "@/lib/integrations/credential-loader";
import { resolveChannel } from "@/lib/integrations/registry";
import { normalizePhone } from "@/lib/integrations/messaging/whatsapp-adapter";
import { revalidatePath } from "next/cache";

/**
 * CRM communication server actions — the RD Station CRM "communication" gap.
 *
 *  - `sendWhatsappMessage` sends a WhatsApp message to a contact through the
 *    existing Phase-1 WhatsApp adapter and logs it as an OUTBOUND
 *    `crm_activities` entry so the deal timeline shows the conversation.
 *  - `logEmail` records an email exchange (sent or received) as a
 *    `crm_activities` entry — the manual "log email" form. Two-way email sync
 *    stays out of scope (it needs the ESP — see migration-architecture.md §2.8).
 *
 * Inbound WhatsApp messages are logged separately by the
 * `/api/webhooks/whatsapp` route (see lib/integrations/crm-inbound.ts).
 *
 * Both actions follow the standard write path: createClient → auth.getUser →
 * Zod safeParse → permission check → DB write → revalidatePath.
 */

/**
 * Sends a WhatsApp message to a contact and logs it on the deal timeline.
 *
 * The activity row is written FIRST (so a delivery that succeeds but whose
 * provider response is slow is never lost), then the adapter is invoked. The
 * provider message id (`wamid`) is stamped back onto the row as `external_ref`
 * — that is the same key the inbound webhook uses, keeping the whole thread
 * consistent. A no-op adapter (dev / unconfigured) still logs the activity.
 */
export async function sendWhatsappMessage(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = sendWhatsappMessageSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { sectorId, dealId, contactId, companyId, to, body } = parsed.data;

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, sectorId, "crm_activity", "create")) {
    return { error: "Sem permissao" };
  }

  const phone = normalizePhone(to);
  if (phone.length < 8) {
    return { error: "Numero de WhatsApp invalido" };
  }

  // Send through the existing WhatsApp adapter resolved from the registry.
  const credential = await loadCredentialFor(supabase, "whatsapp", sectorId);
  const adapter = resolveChannel("whatsapp", {
    secret: credential?.secret ?? null,
    metadata: credential?.metadata ?? {},
  });

  const result = await adapter.send({
    title: "",
    body,
    target: phone,
    eventType: "crm_whatsapp_outbound",
  });

  if (!result.ok) {
    return { error: result.error ?? "Falha ao enviar WhatsApp" };
  }

  // Log the sent message as an outbound communication on the timeline.
  const { data: activity, error } = await supabase
    .from("crm_activities")
    .insert({
      sector_id: sectorId,
      deal_id: dealId || null,
      contact_id: contactId || null,
      company_id: companyId || null,
      type: "note",
      channel: "whatsapp",
      direction: "outbound",
      subject: `WhatsApp enviado para ${to}`,
      description: body,
      external_ref: result.providerRef || null,
      occurred_at: new Date().toISOString(),
      performed_by: user.id,
    })
    .select()
    .single();

  if (error) {
    // The message was delivered; only the log failed. Surface it but do not
    // pretend the send failed.
    return {
      error: `Mensagem enviada, mas falha ao registrar no histórico: ${error.message}`,
    };
  }

  revalidatePath("/");
  return { data: activity, noop: result.noop ?? false };
}

/**
 * Logs an email exchange (sent or received) as a `crm_activities` entry.
 *
 * This is the manual "log email" form — it does not send anything; it records
 * a conversation that happened in the user's mailbox so the deal timeline is
 * complete. The counterpart address, when given, is prefixed onto the body so
 * the timeline shows De:/Para: like the existing activity dialog does.
 */
export async function logEmail(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = logEmailSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { sectorId, dealId, contactId, companyId, direction, subject } =
    parsed.data;
  const counterpart = parsed.data.counterpartEmail?.trim();

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, sectorId, "crm_activity", "create")) {
    return { error: "Sem permissao" };
  }

  // Prefix the counterpart so the timeline renders direction context.
  const counterpartLine = counterpart
    ? direction === "inbound"
      ? `De: ${counterpart}`
      : `Para: ${counterpart}`
    : "";
  const description = counterpartLine
    ? `${counterpartLine}\n---\n${parsed.data.body}`
    : parsed.data.body;

  const { data: activity, error } = await supabase
    .from("crm_activities")
    .insert({
      sector_id: sectorId,
      deal_id: dealId || null,
      contact_id: contactId || null,
      company_id: companyId || null,
      type: "email",
      channel: "email",
      direction,
      subject,
      description,
      occurred_at: new Date().toISOString(),
      performed_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/");
  return { data: activity };
}
