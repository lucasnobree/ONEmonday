"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import {
  createBoardColumnSchema,
  updateBoardColumnSchema,
  reorderBoardColumnsSchema,
} from "@/lib/validations/board-columns";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Resolves the sectors a board belongs to. */
async function boardSectorIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  boardId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("board_sectors")
    .select("sector_id")
    .eq("board_id", boardId);
  return (data ?? []).map((bs) => bs.sector_id);
}

export async function createBoardColumn(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createBoardColumnSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const sectorIds = await boardSectorIds(supabase, parsed.data.boardId);
  const perms = await getUserPermissions(user.id);
  const canCreate = sectorIds.some((id) =>
    hasPermission(perms, id, "board_column", "create")
  );
  if (!canCreate) return { error: "Sem permissao" };

  // New column is appended after the current last one.
  const { data: lastCol } = await supabase
    .from("board_columns")
    .select("position")
    .eq("board_id", parsed.data.boardId)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (lastCol?.position ?? -1) + 1;

  const { data: column, error } = await supabase
    .from("board_columns")
    .insert({
      board_id: parsed.data.boardId,
      name: parsed.data.name,
      color: parsed.data.color ?? null,
      position,
      wip_limit: parsed.data.wipLimit ?? null,
      is_done_column: parsed.data.isDoneColumn ?? false,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/");
  return { data: column };
}

export async function updateBoardColumn(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = updateBoardColumnSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: column } = await supabase
    .from("board_columns")
    .select("board_id")
    .eq("id", parsed.data.id)
    .single();
  if (!column) return { error: "Coluna nao encontrada" };

  const sectorIds = await boardSectorIds(supabase, column.board_id);
  const perms = await getUserPermissions(user.id);
  const canUpdate = sectorIds.some((id) =>
    hasPermission(perms, id, "board_column", "update")
  );
  if (!canUpdate) return { error: "Sem permissao" };

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.color !== undefined) updateData.color = parsed.data.color;
  if (parsed.data.wipLimit !== undefined)
    updateData.wip_limit = parsed.data.wipLimit;
  if (parsed.data.isDoneColumn !== undefined)
    updateData.is_done_column = parsed.data.isDoneColumn;

  if (Object.keys(updateData).length === 0) {
    return { error: "Nenhuma alteracao informada" };
  }

  const { error } = await supabase
    .from("board_columns")
    .update(updateData)
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

/**
 * Reorders a board's columns via the `reorder_board_columns` RPC, which
 * rejects any list that does not exactly match the board's column set.
 */
export async function reorderBoardColumns(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = reorderBoardColumnsSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data, error } = await supabase.rpc("reorder_board_columns", {
    p_board_id: parsed.data.boardId,
    p_column_ids: parsed.data.columnIds,
  });

  if (error) return { error: error.message };

  const result = data as { success: boolean; error?: string };
  if (!result.success) {
    return {
      error:
        result.error === "forbidden"
          ? "Sem permissao"
          : "Nao foi possivel reordenar as colunas",
    };
  }

  revalidatePath("/");
  return { success: true };
}

/**
 * Deletes a board column via the `delete_board_column` RPC. The RPC refuses
 * to delete a column that still holds active cards or the board's last
 * column, returning a structured error this action maps to a friendly
 * message.
 */
export async function deleteBoardColumn(columnId: string) {
  const parsed = z.string().uuid().safeParse(columnId);
  if (!parsed.success) return { error: "ID invalido" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data, error } = await supabase.rpc("delete_board_column", {
    p_column_id: parsed.data,
  });

  if (error) return { error: error.message };

  const result = data as {
    success: boolean;
    error?: string;
    card_count?: number;
  };
  if (!result.success) {
    switch (result.error) {
      case "forbidden":
        return { error: "Sem permissao" };
      case "not_found":
        return { error: "Coluna nao encontrada" };
      case "last_column":
        return { error: "O board precisa de ao menos uma coluna" };
      case "has_cards":
        return {
          error: `A coluna tem ${result.card_count} card(s). Mova-os antes de excluir.`,
        };
      default:
        return { error: "Nao foi possivel excluir a coluna" };
    }
  }

  revalidatePath("/");
  return { success: true };
}
