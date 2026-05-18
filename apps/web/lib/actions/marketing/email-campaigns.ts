"use server";

/**
 * Email-campaign server actions — Phase 5 marketing automation.
 *
 * Compose an email campaign and send it to a recipient list through the
 * configured ESP gateway (Resend). Follows the established write-path shape:
 * createClient -> getUser -> safeParse -> permission check -> (adapter call) ->
 * DB write -> revalidatePath.
 *
 * Honest constraint: a real send needs a Resend account AND a verified sending
 * domain the company must supply. With no credential the ResendAdapter runs in
 * no-op mode — each recipient send is recorded as `skipped` and a clear
 * "gateway de e-mail nao configurado" message is returned. Nothing crashes;
 * nothing fake-claims an email was delivered.
 */
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createEmailCampaignSchema,
  updateEmailCampaignSchema,
  sendEmailCampaignSchema,
} from "@/lib/validations/marketing";
import { loadEmailCredential } from "@/lib/integrations/email-credential-loader";
import {
  resolveEmailAdapter,
  DEFAULT_EMAIL_PROVIDER,
} from "@/lib/integrations/email-registry";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createEmailCampaign(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = createEmailCampaignSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (
    !hasPermission(perms, parsed.data.sectorId, "email_campaign", "create")
  ) {
    return { error: "Sem permissao" };
  }

  const { data, error } = await supabase
    .from("marketing_email_campaigns")
    .insert({
      sector_id: parsed.data.sectorId,
      campaign_id: parsed.data.campaignId || null,
      segment_id: parsed.data.segmentId || null,
      name: parsed.data.name,
      subject: parsed.data.subject,
      from_name: parsed.data.fromName,
      from_email: parsed.data.fromEmail,
      reply_to: parsed.data.replyTo || null,
      body_html: parsed.data.bodyHtml,
      body_text: parsed.data.bodyText,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/marketing/email");
  return { data };
}

export async function updateEmailCampaign(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = updateEmailCampaignSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: existing } = await supabase
    .from("marketing_email_campaigns")
    .select("sector_id, status")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Campanha de e-mail não encontrada" };

  const perms = await getUserPermissions(user.id);
  if (
    !hasPermission(perms, existing.sector_id, "email_campaign", "update")
  ) {
    return { error: "Sem permissao" };
  }

  // A campaign that has already been sent is locked from content edits.
  if (existing.status === "sent" || existing.status === "sending") {
    return { error: "Campanha já enviada não pode ser editada" };
  }

  const { error } = await supabase
    .from("marketing_email_campaigns")
    .update({
      campaign_id: parsed.data.campaignId || null,
      segment_id: parsed.data.segmentId || null,
      name: parsed.data.name,
      subject: parsed.data.subject,
      from_name: parsed.data.fromName,
      from_email: parsed.data.fromEmail,
      reply_to: parsed.data.replyTo || null,
      body_html: parsed.data.bodyHtml,
      body_text: parsed.data.bodyText,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/marketing/email");
  return { success: true };
}

export async function deleteEmailCampaign(emailCampaignId: string) {
  const parsed = z.string().uuid().safeParse(emailCampaignId);
  if (!parsed.success) return { error: "ID inválido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: campaign } = await supabase
    .from("marketing_email_campaigns")
    .select("sector_id")
    .eq("id", emailCampaignId)
    .single();
  if (!campaign) return { error: "Campanha de e-mail não encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, campaign.sector_id, "email_campaign", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("marketing_email_campaigns")
    .update({ is_active: false })
    .eq("id", emailCampaignId);

  if (error) return { error: error.message };

  revalidatePath("/marketing/email");
  return { success: true };
}

/**
 * Sends an email campaign to an explicit recipient list through the ESP.
 *
 * This is the send entrypoint — a "send now" button or a sequence step calls
 * it. For each recipient it calls the ResendAdapter and records one
 * `marketing_email_sends` row. With no ESP credential the adapter is in no-op
 * mode: every recipient is recorded `skipped` and the caller is told the
 * gateway is not configured.
 *
 * The campaign roll-up counters (recipient/delivered/failed) are updated and
 * the campaign is moved to `sent`.
 */
export async function sendEmailCampaign(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = sendEmailCampaignSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: campaign } = await supabase
    .from("marketing_email_campaigns")
    .select(
      "id, sector_id, status, subject, from_name, from_email, reply_to, body_html, body_text"
    )
    .eq("id", parsed.data.emailCampaignId)
    .eq("is_active", true)
    .single();
  if (!campaign) return { error: "Campanha de e-mail não encontrada" };

  const perms = await getUserPermissions(user.id);
  if (
    !hasPermission(perms, campaign.sector_id, "email_campaign", "update")
  ) {
    return { error: "Sem permissao" };
  }

  if (campaign.status === "sent" || campaign.status === "sending") {
    return { error: "Campanha já enviada" };
  }

  // Resolve the ESP gateway credential (no-op mode when unconfigured).
  const credential = await loadEmailCredential(supabase, campaign.sector_id);
  const provider = credential.provider ?? DEFAULT_EMAIL_PROVIDER;
  const adapter = resolveEmailAdapter(provider, credential.config);

  // Mark the campaign as sending while the run is in progress.
  await supabase
    .from("marketing_email_campaigns")
    .update({ status: "sending" })
    .eq("id", campaign.id);

  let delivered = 0;
  let failed = 0;
  let skipped = 0;
  const sendRows: Record<string, unknown>[] = [];

  for (const recipient of parsed.data.recipients) {
    const result = await adapter.send({
      to: recipient.email,
      toName: recipient.name,
      from: campaign.from_email,
      fromName: campaign.from_name,
      replyTo: campaign.reply_to ?? undefined,
      subject: campaign.subject,
      html: campaign.body_html,
      text: campaign.body_text || undefined,
      // Deterministic idempotency key — a retry never double-sends at the ESP.
      idempotencyKey: `ec-${campaign.id}-${recipient.email}`,
    });

    let status: string;
    if (result.noop) {
      status = "skipped";
      skipped += 1;
    } else if (result.ok) {
      status = "sent";
      delivered += 1;
    } else {
      status = "failed";
      failed += 1;
    }

    sendRows.push({
      sector_id: campaign.sector_id,
      email_campaign_id: campaign.id,
      recipient_email: recipient.email,
      recipient_name: recipient.name ?? null,
      status,
      provider_ref: result.providerRef ?? null,
      error: result.noop
        ? "Gateway de e-mail nao configurado — nada foi enviado"
        : (result.error ?? null),
      sent_at: result.ok && !result.noop ? new Date().toISOString() : null,
    });
  }

  const { error: sendErr } = await supabase
    .from("marketing_email_sends")
    .insert(sendRows);
  if (sendErr) {
    // Roll the campaign back to draft so the operator can retry.
    await supabase
      .from("marketing_email_campaigns")
      .update({ status: "draft" })
      .eq("id", campaign.id);
    return { error: sendErr.message };
  }

  await supabase
    .from("marketing_email_campaigns")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      recipient_count: parsed.data.recipients.length,
      delivered_count: delivered,
      failed_count: failed,
    })
    .eq("id", campaign.id);

  revalidatePath("/marketing/email");

  const noop = skipped === parsed.data.recipients.length;
  return {
    success: true,
    sent: delivered,
    failed,
    skipped,
    noop,
    message: noop
      ? "Gateway de e-mail não configurado. Os envios foram registrados como ignorados."
      : undefined,
  };
}
