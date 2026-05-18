"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createDealSchema,
  closeDealLostSchema,
  assignDealOwnerSchema,
} from "@/lib/validations/crm";
import { enqueueCrmEvent } from "@/lib/actions/crm/crm-dispatch";
import {
  buildDealWonEvent,
  buildDealLostEvent,
} from "@/lib/crm/crm-events";
import { lostReasonLabel } from "@/lib/crm/lost-reasons";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createDeal(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createDealSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "deal", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: maxPos } = await supabase
    .from("cards")
    .select("position")
    .eq("column_id", parsed.data.columnId)
    .eq("is_active", true)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (maxPos?.position ?? -1) + 1;

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description || null,
      priority: parsed.data.priority,
      column_id: parsed.data.columnId,
      board_id: parsed.data.boardId,
      sector_id: parsed.data.sectorId,
      created_by: user.id,
      position,
    })
    .select()
    .single();

  if (cardError) return { error: cardError.message };

  const { data: deal, error: dealError } = await supabase
    .from("crm_deals")
    .insert({
      card_id: card.id,
      sector_id: parsed.data.sectorId,
      company_id: parsed.data.companyId || null,
      contact_id: parsed.data.contactId || null,
      // Default the owner to the creator when none was picked, so a new deal
      // is never silently unassigned.
      owner_id: parsed.data.ownerId || user.id,
      value: parsed.data.value || null,
      currency: parsed.data.currency,
      expected_close_date: parsed.data.expectedCloseDate || null,
      win_probability: parsed.data.winProbability || null,
      source: parsed.data.source || null,
    })
    .select()
    .single();

  if (dealError) return { error: dealError.message };

  await supabase.from("card_activity_log").insert({
    card_id: card.id,
    user_id: user.id,
    action: "card_created",
    metadata: { title: card.title, deal_id: deal.id },
  });

  revalidatePath("/");
  return { data: { ...deal, card } };
}

export async function closeDealWon(dealId: string) {
  const parsed = z.string().uuid().safeParse(dealId);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: deal } = await supabase
    .from("crm_deals")
    .select(
      `sector_id, card_id, value,
       cards!inner (title),
       crm_companies (name),
       owner:users!crm_deals_owner_id_fkey (full_name)`
    )
    .eq("id", dealId)
    .single();

  if (!deal) return { error: "Deal nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, deal.sector_id, "deal", "update")) {
    return { error: "Sem permissao" };
  }

  const { error: dealError } = await supabase
    .from("crm_deals")
    .update({
      actual_close_date: new Date().toISOString().split("T")[0],
      // Clear any prior lost markers so a re-won deal is not miscounted as lost.
      lost_reason: null,
      lost_reason_category: null,
    })
    .eq("id", dealId);

  if (dealError) return { error: dealError.message };

  // Fan the "deal won" event out to Teams / WhatsApp via the Phase-1 outbox.
  const wonCard = deal.cards as unknown as { title: string } | null;
  const wonCompany = deal.crm_companies as unknown as { name: string } | null;
  const wonOwner = deal.owner as unknown as { full_name: string } | null;
  await enqueueCrmEvent(supabase, {
    sectorId: deal.sector_id,
    userId: user.id,
    event: buildDealWonEvent({
      dealTitle: wonCard?.title ?? "Deal",
      value: deal.value,
      companyName: wonCompany?.name ?? null,
      ownerName: wonOwner?.full_name ?? null,
    }),
  });

  const { data: card } = await supabase
    .from("cards")
    .select("board_id")
    .eq("id", deal.card_id)
    .single();

  if (card) {
    const { data: doneColumn } = await supabase
      .from("board_columns")
      .select("id")
      .eq("board_id", card.board_id)
      .eq("is_done_column", true)
      .limit(1)
      .single();

    if (doneColumn) {
      await supabase
        .from("cards")
        .update({ column_id: doneColumn.id })
        .eq("id", deal.card_id);
    }
  }

  revalidatePath("/");
  return { success: true };
}

export async function closeDealLost(input: {
  dealId: string;
  category: string;
  reason: string;
}) {
  const parsed = closeDealLostSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: deal } = await supabase
    .from("crm_deals")
    .select(
      `sector_id, value,
       cards!inner (title),
       crm_companies (name)`
    )
    .eq("id", parsed.data.dealId)
    .single();

  if (!deal) return { error: "Deal nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, deal.sector_id, "deal", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("crm_deals")
    .update({
      lost_reason: parsed.data.reason,
      lost_reason_category: parsed.data.category,
      actual_close_date: new Date().toISOString().split("T")[0],
    })
    .eq("id", parsed.data.dealId);

  if (error) return { error: error.message };

  // Fan the "deal lost" event out to Teams / WhatsApp via the Phase-1 outbox.
  const lostCard = deal.cards as unknown as { title: string } | null;
  const lostCompany = deal.crm_companies as unknown as { name: string } | null;
  await enqueueCrmEvent(supabase, {
    sectorId: deal.sector_id,
    userId: user.id,
    event: buildDealLostEvent({
      dealTitle: lostCard?.title ?? "Deal",
      value: deal.value,
      companyName: lostCompany?.name ?? null,
      lostReason: `${lostReasonLabel(parsed.data.category)} — ${parsed.data.reason}`,
    }),
  });

  revalidatePath("/");
  return { success: true };
}

/**
 * Reassigns a deal's owner (the responsible salesperson). Passing a null
 * `ownerId` clears the owner. Requires the `deal:update` permission.
 */
export async function assignDealOwner(input: unknown) {
  const parsed = assignDealOwnerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: deal } = await supabase
    .from("crm_deals")
    .select("sector_id")
    .eq("id", parsed.data.dealId)
    .single();

  if (!deal) return { error: "Deal nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, deal.sector_id, "deal", "update")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("crm_deals")
    .update({ owner_id: parsed.data.ownerId })
    .eq("id", parsed.data.dealId);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}
