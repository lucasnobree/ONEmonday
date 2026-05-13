"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { escalateCardSchema } from "@/lib/validations/escalation";
import { revalidatePath } from "next/cache";

export async function escalateCard(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = escalateCardSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);

  const { data: sourceCard } = await supabase
    .from("cards")
    .select("id, title, description, priority, sector_id, board_id")
    .eq("id", parsed.data.sourceCardId)
    .eq("is_active", true)
    .single();

  if (!sourceCard) return { error: "Card nao encontrado" };

  if (!hasPermission(perms, sourceCard.sector_id, "card", "escalate")) {
    return { error: "Sem permissao para escalar neste setor" };
  }

  if (
    !hasPermission(perms, parsed.data.targetSectorId, "card", "create") &&
    !perms.isGlobalAdmin
  ) {
    return { error: "Sem permissao para criar cards no setor destino" };
  }

  const { data: firstColumn } = await supabase
    .from("board_columns")
    .select("id")
    .eq("board_id", parsed.data.targetBoardId)
    .order("position", { ascending: true })
    .limit(1)
    .single();

  if (!firstColumn) return { error: "Board destino sem colunas" };

  const { data: maxPos } = await supabase
    .from("cards")
    .select("position")
    .eq("column_id", firstColumn.id)
    .eq("is_active", true)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (maxPos?.position ?? -1) + 1;

  const { data: newCard, error: cardError } = await supabase
    .from("cards")
    .insert({
      title: `[Escalado] ${sourceCard.title}`,
      description: sourceCard.description,
      priority: sourceCard.priority,
      column_id: firstColumn.id,
      board_id: parsed.data.targetBoardId,
      sector_id: parsed.data.targetSectorId,
      created_by: user.id,
      position,
    })
    .select()
    .single();

  if (cardError) return { error: cardError.message };

  const { data: crossRef, error: refError } = await supabase
    .from("card_cross_references")
    .insert({
      source_card_id: parsed.data.sourceCardId,
      target_card_id: newCard.id,
      reference_type: parsed.data.referenceType,
      status: "open",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (refError) return { error: refError.message };

  await supabase.from("card_activity_log").insert([
    {
      card_id: parsed.data.sourceCardId,
      user_id: user.id,
      action: "card_escalated",
      metadata: {
        target_sector: parsed.data.targetSectorId,
        target_board: parsed.data.targetBoardId,
        note: parsed.data.note ?? null,
      },
    },
    {
      card_id: newCard.id,
      user_id: user.id,
      action: "card_received_escalation",
      metadata: {
        source_sector: sourceCard.sector_id,
        note: parsed.data.note ?? null,
      },
    },
  ]);

  revalidatePath("/");
  return { data: { crossRefId: crossRef.id, targetCardId: newCard.id } };
}
