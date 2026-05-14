"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { createProposalSchema } from "@/lib/validations/crm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().min(0.01),
  unit_price: z.number().min(0),
});

export async function createProposal(formData: unknown) {
  const schema = createProposalSchema.extend({
    items: z.string().optional(),
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = schema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorId, "deal", "create")) {
    return { error: "Sem permissao" };
  }

  let items: z.infer<typeof itemSchema>[] = [];
  if (parsed.data.items) {
    try {
      const rawItems = JSON.parse(parsed.data.items);
      const itemsResult = z.array(itemSchema).safeParse(rawItems);
      if (itemsResult.success) items = itemsResult.data;
    } catch {
      // ignore parse error, proceed without items
    }
  }

  const calculatedValue = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  const { data: proposal, error } = await supabase
    .from("crm_proposals")
    .insert({
      deal_id: parsed.data.dealId,
      sector_id: parsed.data.sectorId,
      title: parsed.data.title,
      content: parsed.data.content || null,
      value: items.length > 0 ? calculatedValue : (parsed.data.value ?? 0),
      expires_at: parsed.data.expiresAt || null,
      created_by: user.id,
      status: "draft",
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from("crm_proposal_items")
      .insert(
        items.map((item, i) => ({
          proposal_id: proposal.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          position: i,
        }))
      );
    if (itemsError) return { error: itemsError.message };
  }

  revalidatePath("/crm/proposals");
  revalidatePath("/crm/pipeline");
  return { data: proposal };
}

export async function updateProposal(formData: unknown) {
  const schema = createProposalSchema.extend({
    id: z.string().uuid(),
    items: z.string().optional(),
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = schema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: existing } = await supabase
    .from("crm_proposals")
    .select("sector_id")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return { error: "Proposta nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, existing.sector_id, "deal", "update")) {
    return { error: "Sem permissao" };
  }

  let items: z.infer<typeof itemSchema>[] = [];
  if (parsed.data.items) {
    try {
      const rawItems = JSON.parse(parsed.data.items);
      const itemsResult = z.array(itemSchema).safeParse(rawItems);
      if (itemsResult.success) items = itemsResult.data;
    } catch {
      // ignore
    }
  }

  const calculatedValue = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  const { error } = await supabase
    .from("crm_proposals")
    .update({
      deal_id: parsed.data.dealId,
      title: parsed.data.title,
      content: parsed.data.content || null,
      value: items.length > 0 ? calculatedValue : (parsed.data.value ?? 0),
      expires_at: parsed.data.expiresAt || null,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  // Replace items: delete all then re-insert
  await supabase
    .from("crm_proposal_items")
    .delete()
    .eq("proposal_id", parsed.data.id);

  if (items.length > 0) {
    await supabase.from("crm_proposal_items").insert(
      items.map((item, i) => ({
        proposal_id: parsed.data.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        position: i,
      }))
    );
  }

  revalidatePath("/crm/proposals");
  revalidatePath("/crm/pipeline");
  return { success: true };
}

export async function updateProposalStatus(
  proposalId: string,
  status: string
) {
  const idParsed = z.string().uuid().safeParse(proposalId);
  if (!idParsed.success) return { error: "ID invalido" };

  const validStatuses = ["draft", "sent", "viewed", "accepted", "rejected", "expired"];
  if (!validStatuses.includes(status)) return { error: "Status invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: proposal } = await supabase
    .from("crm_proposals")
    .select("sector_id, status")
    .eq("id", proposalId)
    .single();
  if (!proposal) return { error: "Proposta nao encontrada" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, proposal.sector_id, "deal", "update")) {
    return { error: "Sem permissao" };
  }

  const updateData: Record<string, unknown> = { status };
  if (status === "sent" && proposal.status !== "sent") {
    updateData.sent_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("crm_proposals")
    .update(updateData)
    .eq("id", proposalId);

  if (error) return { error: error.message };

  revalidatePath("/crm/proposals");
  revalidatePath("/crm/pipeline");
  return { success: true };
}

export async function deleteProposal(proposalId: string) {
  const idParsed = z.string().uuid().safeParse(proposalId);
  if (!idParsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: proposal } = await supabase
    .from("crm_proposals")
    .select("sector_id, status")
    .eq("id", proposalId)
    .single();
  if (!proposal) return { error: "Proposta nao encontrada" };

  if (proposal.status !== "draft") {
    return { error: "Apenas propostas em rascunho podem ser excluidas" };
  }

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, proposal.sector_id, "deal", "delete")) {
    return { error: "Sem permissao" };
  }

  const { error } = await supabase
    .from("crm_proposals")
    .update({ is_active: false })
    .eq("id", proposalId);

  if (error) return { error: error.message };

  revalidatePath("/crm/proposals");
  return { success: true };
}
