import { createClient } from "@/lib/supabase/server";
import type { UserPermissions, Resource, Action } from "./types";

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
      roles!inner(slug, level),
      roles(
        role_permissions(
          permissions(resource, action)
        )
      )
    `
    )
    .eq("user_id", userId);

  const mappedRoles = (sectorRoles || []).map((sr: any) => ({
    sectorId: sr.sector_id,
    sectorSlug: sr.sectors.slug,
    sectorName: sr.sectors.name,
    roleId: sr.role_id,
    roleSlug: sr.roles.slug,
    roleLevel: sr.roles.level,
    permissions: (sr.roles.role_permissions || []).map((rp: any) => ({
      resource: rp.permissions.resource,
      action: rp.permissions.action,
    })),
  }));

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
