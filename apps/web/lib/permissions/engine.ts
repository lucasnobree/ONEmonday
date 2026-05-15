import { createClient } from "@/lib/supabase/server";
import { mapSectorRoleRow } from "./types";
import type {
  UserPermissions,
  Resource,
  Action,
  SectorRoleRow,
} from "./types";

export async function getUserPermissions(
  userId: string
): Promise<UserPermissions> {
  const supabase = await createClient();

  const { data: user } = await supabase
    .from("users")
    .select("is_global_admin")
    .eq("id", userId)
    .single();

  const { data: sectorRoles } = await supabase
    .from("user_sector_roles")
    .select(
      `
      sector_id,
      sectors!inner(slug, name),
      role_id,
      roles!inner(slug, level, role_permissions(permissions(resource, action)))
    `
    )
    .eq("user_id", userId);

  const mappedRoles = ((sectorRoles ?? []) as unknown as SectorRoleRow[]).map(
    mapSectorRoleRow
  );

  return {
    userId,
    isGlobalAdmin: user?.is_global_admin ?? false,
    sectorRoles: mappedRoles,
  };
}

export function hasPermission(
  permissions: UserPermissions,
  sectorId: string,
  resource: Resource,
  action: Action
): boolean {
  if (permissions.isGlobalAdmin) return true;

  const sectorRole = permissions.sectorRoles.find(
    (sr) => sr.sectorId === sectorId
  );
  if (!sectorRole) return false;

  return sectorRole.permissions.some(
    (p) => p.resource === resource && p.action === action
  );
}

export function getUserSectors(
  permissions: UserPermissions
): { id: string; slug: string; name: string }[] {
  if (permissions.isGlobalAdmin) return [];
  return permissions.sectorRoles.map((sr) => ({
    id: sr.sectorId,
    slug: sr.sectorSlug,
    name: sr.sectorName,
  }));
}
