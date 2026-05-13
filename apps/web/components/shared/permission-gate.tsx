"use client";

import { usePermissions } from "@/hooks/use-permissions";
import type { Resource, Action } from "@/lib/permissions/types";

interface PermissionGateProps {
  sectorId: string;
  resource: Resource;
  action: Action;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({
  sectorId,
  resource,
  action,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission, isLoading } = usePermissions();

  if (isLoading) return null;
  if (!hasPermission(sectorId, resource, action)) return fallback;
  return children;
}
