"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, hasPermission } from "@/lib/permissions/engine";
import { createBoardSchema, updateBoardSchema } from "@/lib/validations/boards";
import { revalidatePath } from "next/cache";

export async function createBoard(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = createBoardSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const perms = await getUserPermissions(user.id);
  if (!hasPermission(perms, parsed.data.sectorIds[0], "board", "create")) {
    return { error: "Sem permissao" };
  }

  const { data: board, error } = await supabase
    .from("boards")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      visibility: parsed.data.visibility,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  const boardSectors = parsed.data.sectorIds.map((sectorId) => ({
    board_id: board.id,
    sector_id: sectorId,
  }));
  await supabase.from("board_sectors").insert(boardSectors);

  const defaultColumns = [
    { board_id: board.id, name: "A Fazer", position: 0, color: "#94a3b8" },
    {
      board_id: board.id,
      name: "Em Progresso",
      position: 1,
      color: "#3b82f6",
    },
    { board_id: board.id, name: "Em Revisao", position: 2, color: "#f59e0b" },
    {
      board_id: board.id,
      name: "Concluido",
      position: 3,
      color: "#22c55e",
      is_done_column: true,
    },
  ];
  await supabase.from("board_columns").insert(defaultColumns);

  revalidatePath("/");
  return { data: board };
}

export async function updateBoard(formData: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const parsed = updateBoardSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: boardSectors } = await supabase
    .from("board_sectors")
    .select("sector_id")
    .eq("board_id", parsed.data.id);

  const perms = await getUserPermissions(user.id);
  const canUpdate = boardSectors?.some((bs) =>
    hasPermission(perms, bs.sector_id, "board", "update")
  );
  if (!canUpdate) return { error: "Sem permissao" };

  const { error } = await supabase
    .from("boards")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      visibility: parsed.data.visibility,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

export async function deleteBoard(boardId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nao autenticado" };

  const { data: boardSectors } = await supabase
    .from("board_sectors")
    .select("sector_id")
    .eq("board_id", boardId);

  const perms = await getUserPermissions(user.id);
  const canDelete = boardSectors?.some((bs) =>
    hasPermission(perms, bs.sector_id, "board", "delete")
  );
  if (!canDelete) return { error: "Sem permissao" };

  const { error } = await supabase
    .from("boards")
    .update({ is_active: false })
    .eq("id", boardId);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}
