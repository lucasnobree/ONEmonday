"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { mapSectorRoleRow } from "@/lib/permissions/types";
import type {
  UserPermissions,
  Resource,
  Action,
  SectorRoleRow,
} from "@/lib/permissions/types";

async function fetchPermissions(): Promise<UserPermissions> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await supabase
    .from("users")
    .select("is_global_admin")
    .eq("id", user.id)
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
    .eq("user_id", user.id);

  const mappedRoles = (
    (sectorRoles ?? []) as unknown as SectorRoleRow[]
  ).map(mapSectorRoleRow);

  return {
    userId: user.id,
    isGlobalAdmin: userData?.is_global_admin ?? false,
    sectorRoles: mappedRoles,
  };
}

export function usePermissions() {
  const {
    data: permissions,
    isLoading,
    error,
  } = useQuery<UserPermissions>({
    queryKey: ["user-permissions"],
    queryFn: fetchPermissions,
    staleTime: 5 * 60 * 1000,
  });

  function checkPermission(
    sectorId: string,
    resource: Resource,
    action: Action
  ): boolean {
    if (!permissions) return false;
    if (permissions.isGlobalAdmin) return true;

    const sectorRole = permissions.sectorRoles.find(
      (sr) => sr.sectorId === sectorId
    );
    if (!sectorRole) return false;

    return sectorRole.permissions.some(
      (p) => p.resource === resource && p.action === action
    );
  }

  return {
    permissions,
    isLoading,
    error,
    hasPermission: checkPermission,
    isGlobalAdmin: permissions?.isGlobalAdmin ?? false,
    sectorRoles: permissions?.sectorRoles ?? [],
  };
}
