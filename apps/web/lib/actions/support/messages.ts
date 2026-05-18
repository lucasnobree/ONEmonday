"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { addTicketMessageSchema } from "@/lib/validations/support";
import { loadEmailCredential } from "@/lib/integrations/email-credential-loader";
import {
  resolveEmailAdapter,
  DEFAULT_EMAIL_PROVIDER,
} from "@/lib/integrations/email-registry";
import { isSlaBreached } from "@/lib/support/sla";
import { revalidatePath } from "next/cache";

/**
 * Support Desk ticket messaging — the Wave 4 audit H3 "public reply channel".
 *
 * The legacy detail sheet only posts internal `card_comments`; the requester
 * could never be answered from the product. `addTicketMessage` writes a
 * `ticket_messages` row with an explicit visibility:
 *
 *   - `internal` — a private agent note, equivalent to the old comment.
 *   - `public`   — a reply meant for the requester. For an `email`-channel
 *     ticket it is delivered through the existing Resend ESP adapter (the
 *     same Phase-5 adapter the CRM `sendEmail` action reuses); when no ESP is
 *     configured the adapter runs in no-op mode and the row records the reply
 *     as `skipped` so the demo flow never crashes.
 *
 * A public reply also auto-stamps `first_response_at` the first time it lands
 * (Wave 4 D3 — FRT measured to the first substantive outbound reply, not a
 * manual button).
 *
 * Standard write path: createClient -> auth.getUser -> Zod safeParse ->
 * permission check -> DB write -> revalidatePath.
 */

/** Wraps a plain-text reply body in a minimal HTML document for the ESP. */
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.5">${escaped}</div>`;
}

export async function addTicketMessage(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = addTicketMessageSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { ticketId, visibility, body } = parsed.data;

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select(
      "id, sector_id, card_id, channel, requester_email, first_response_at, sla_response_due_at"
    )
    .eq("id", ticketId)
    .single();
  if (!ticket) return { error: "Ticket não encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, ticket.sector_id, "ticket", "update")) {
    return { error: "Sem permissão" };
  }

  // A public reply on an email-channel ticket goes out through the ESP.
  let deliveryStatus:
    | "not_applicable"
    | "pending"
    | "sent"
    | "skipped"
    | "failed" = "not_applicable";
  let deliveryRef: string | null = null;
  let deliveryError: string | null = null;
  let noop = false;

  if (visibility === "public" && ticket.channel === "email") {
    if (!ticket.requester_email) {
      return {
        error: "Ticket de e-mail sem endereço do solicitante",
      };
    }

    const credential = await loadEmailCredential(supabase, ticket.sector_id);
    const adapter = resolveEmailAdapter(
      credential.provider ?? DEFAULT_EMAIL_PROVIDER,
      credential.config
    );

    const meta = credential.config.metadata ?? {};
    const fromAddress =
      typeof meta.fromAddress === "string" && meta.fromAddress.includes("@")
        ? meta.fromAddress
        : "no-reply@onemonday.local";
    const fromName =
      typeof meta.fromName === "string" ? meta.fromName : "Suporte";

    const { data: card } = await supabase
      .from("cards")
      .select("title")
      .eq("id", ticket.card_id)
      .single();
    const subject = `Re: ${card?.title ?? "Seu chamado de suporte"}`;

    const result = await adapter.send({
      to: ticket.requester_email,
      from: fromAddress,
      fromName,
      replyTo: fromAddress,
      subject,
      html: textToHtml(body),
      text: body,
    });

    noop = result.noop ?? false;
    if (!result.ok) {
      // The ESP rejected the email — record the attempt as failed so the
      // timeline shows the reply was not delivered, but still surface it.
      deliveryStatus = "failed";
      deliveryError = result.error ?? "Falha ao enviar e-mail";
    } else if (result.noop) {
      // No ESP configured — the reply is logged but nothing was sent.
      deliveryStatus = "skipped";
    } else {
      deliveryStatus = "sent";
      deliveryRef = result.providerRef ?? null;
    }
  } else if (visibility === "public") {
    // Public reply on a non-email channel — nothing to deliver out-of-band;
    // the reply is logged for the requester-facing thread.
    deliveryStatus = "not_applicable";
  }

  const { data: message, error } = await supabase
    .from("ticket_messages")
    .insert({
      ticket_id: ticketId,
      author_id: user.id,
      visibility,
      body,
      delivery_status: deliveryStatus,
      delivery_ref: deliveryRef,
      delivery_error: deliveryError,
    })
    .select("id, visibility, body, delivery_status, created_at")
    .single();

  if (error) return { error: error.message };

  await supabase.from("card_activity_log").insert({
    card_id: ticket.card_id,
    user_id: user.id,
    action: "comment_added",
    metadata: {
      title:
        visibility === "public"
          ? "Resposta pública enviada"
          : "Nota interna adicionada",
    },
  });

  // A public reply is the first substantive outbound response: auto-stamp
  // first_response_at the first time one lands (Wave 4 D3).
  if (visibility === "public" && !ticket.first_response_at) {
    const now = new Date();
    await supabase
      .from("support_tickets")
      .update({
        first_response_at: now.toISOString(),
        sla_response_breached: isSlaBreached(ticket.sla_response_due_at, now),
      })
      .eq("id", ticket.id);
  }

  revalidatePath("/");
  return { data: message, noop, deliveryStatus };
}
