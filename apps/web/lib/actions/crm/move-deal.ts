"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const moveDealSchema = z.object({
  dealId: z.string().uuid(),
  columnId: z.string().uuid(),
});

export async function moveDealToColumn(input: {
  dealId: string;
  columnId: string;
}) {
  const parsed = moveDealSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados invalidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: deal } = await supabase
    .from("crm_deals")
    .select("sector_id, card_id")
    .eq("id", parsed.data.dealId)
    .single();

  if (!deal) return { error: "Deal nao encontrado" };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, deal.sector_id, "deal", "update")) {
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

  const { error: updateError } = await supabase
    .from("cards")
    .update({ column_id: parsed.data.columnId, position })
    .eq("id", deal.card_id);

  if (updateError) return { error: updateError.message };

  const { data: column } = await supabase
    .from("board_columns")
    .select("name")
    .eq("id", parsed.data.columnId)
    .single();

  await supabase.from("card_activity_log").insert({
    card_id: deal.card_id,
    user_id: user.id,
    action: "card_moved",
    metadata: {
      deal_id: parsed.data.dealId,
      new_column_id: parsed.data.columnId,
      new_column_name: column?.name ?? null,
    },
  });

  revalidatePath("/");
  return { success: true };
}
