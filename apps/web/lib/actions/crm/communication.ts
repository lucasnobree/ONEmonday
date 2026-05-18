"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  sendWhatsappMessageSchema,
  logEmailSchema,
  sendEmailSchema,
} from "@/lib/validations/crm";
import { loadCredentialFor } from "@/lib/integrations/credential-loader";
import { loadEmailCredential } from "@/lib/integrations/email-credential-loader";
import { resolveChannel } from "@/lib/integrations/registry";
import {
  resolveEmailAdapter,
  DEFAULT_EMAIL_PROVIDER,
} from "@/lib/integrations/email-registry";
import { normalizePhone } from "@/lib/integrations/messaging/whatsapp-adapter";
import { revalidatePath } from "next/cache";

/**
 * Wraps a plain-text email body in a minimal HTML document. The composer
 * captures plain text; the ESP `send` contract requires an `html` field, so
 * the text is HTML-escaped and its line breaks preserved.
 */
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.5">${escaped}</div>`;
}

/**
 * CRM communication server actions — the RD Station CRM "communication" gap.
 *
 *  - `sendWhatsappMessage` sends a WhatsApp message to a contact through the
 *    existing Phase-1 WhatsApp adapter and logs it as an OUTBOUND
 *    `crm_activities` entry so the deal timeline shows the conversation.
 *  - `sendEmail` sends an email to a contact through the existing Phase-5
 *    Resend ESP adapter and logs it as an OUTBOUND `email`-channel
 *    `crm_activities` entry — the RD Station CRM "send email from a deal".
 *  - `logEmail` records an email exchange (sent or received) as a
 *    `crm_activities` entry — the manual "log email" form, kept for emails
 *    sent outside ONEmonday.
 *
 * Inbound WhatsApp messages are logged by the `/api/webhooks/whatsapp` route
 * (see lib/integrations/crm-inbound.ts); inbound emails by the
 * `/api/webhooks/email` route (see lib/integrations/crm-email-inbound.ts). A
 * full IMAP two-way mailbox sync stays out of scope — this is webhook-based
 * inbound logging only (migration-architecture.md §2.8).
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

/**
 * Sends an email to a deal's contact through the Resend ESP and logs it on the
 * deal timeline — the RD Station CRM "send email from a deal" replacement.
 *
 * Reuses the Phase-5 Resend adapter (`lib/integrations/email/`); no new ESP is
 * added. The sender address comes from the `email` integration credential's
 * metadata (`fromAddress` / `fromName`) — it must be on a domain verified with
 * the ESP. When no credential is configured the adapter runs in no-op mode:
 * nothing is sent, but the activity is still logged so the demo flow works and
 * the result is flagged `noop`.
 *
 * The activity is written AFTER a successful send so a failed send never
 * leaves a misleading "sent" entry; the provider message id is stamped onto
 * the row as `external_ref`, the same idempotency key the inbound webhook
 * uses, keeping the whole thread consistent.
 */
export async function sendEmail(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = sendEmailSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { sectorId, dealId, contactId, companyId, to, subject, body } =
    parsed.data;

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, sectorId, "crm_activity", "create")) {
    return { error: "Sem permissao" };
  }

  // Resolve the email credential for the sector (global fallback) and build
  // the Resend adapter — unconfigured => no-op mode.
  const credential = await loadEmailCredential(supabase, sectorId);
  const adapter = resolveEmailAdapter(
    credential.provider ?? DEFAULT_EMAIL_PROVIDER,
    credential.config
  );

  // The verified sender is configured in the credential metadata.
  const meta = credential.config.metadata ?? {};
  const fromAddress =
    typeof meta.fromAddress === "string" && meta.fromAddress.includes("@")
      ? meta.fromAddress
      : "no-reply@onemonday.local";
  const fromName =
    typeof meta.fromName === "string" ? meta.fromName : undefined;

  const result = await adapter.send({
    to,
    from: fromAddress,
    fromName,
    subject,
    html: textToHtml(body),
    text: body,
  });

  if (!result.ok) {
    return { error: result.error ?? "Falha ao enviar e-mail" };
  }

  // Log the sent email as an outbound communication on the timeline.
  const { data: activity, error } = await supabase
    .from("crm_activities")
    .insert({
      sector_id: sectorId,
      deal_id: dealId || null,
      contact_id: contactId || null,
      company_id: companyId || null,
      type: "email",
      channel: "email",
      direction: "outbound",
      subject,
      description: `Para: ${to}\n---\n${body}`,
      external_ref: result.providerRef || null,
      occurred_at: new Date().toISOString(),
      performed_by: user.id,
    })
    .select()
    .single();

  if (error) {
    // The email was accepted by the ESP; only the log failed. Surface it but
    // do not pretend the send failed.
    return {
      error: `E-mail enviado, mas falha ao registrar no histórico: ${error.message}`,
    };
  }

  revalidatePath("/");
  return { data: activity, noop: result.noop ?? false };
}
