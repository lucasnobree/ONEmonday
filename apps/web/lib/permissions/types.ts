export type Resource =
  | "board"
  | "board_column"
  | "card"
  | "card_comment"
  | "card_attachment"
  | "card_checklist"
  | "card_template"
  | "project"
  | "dashboard"
  | "settings"
  | "user"
  | "notification"
  | "saved_view"
  // Support Desk
  | "ticket"
  | "sla_rule"
  | "kb_article"
  | "canned_response"
  // CRM
  | "contact"
  | "company"
  | "deal"
  | "crm_activity"
  | "proposal"
  | "lead"
  | "lead_form"
  // RH
  | "employee"
  | "time_off"
  | "job_opening"
  | "candidate"
  | "onboarding"
  | "performance"
  | "pdi"
  | "survey"
  // Finance
  | "invoice"
  | "expense"
  | "budget"
  | "transaction"
  // Legal (Juridico)
  | "contract"
  | "legal_matter"
  | "clause"
  // Analytics
  | "analytics_report"
  // Dev-Tools
  | "service"
  | "incident"
  | "deployment"
  | "feature_flag"
  // Marketing
  | "campaign"
  | "content_item"
  | "audience_segment"
  | "email_campaign"
  | "automation"
  // Integration layer (external-provider config + outbound dispatch)
  | "integration";

export type Action =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "move"
  | "assign"
  | "escalate"
  | "export"
  | "manage"
  | "invite"
  | "deactivate"
  // Finance: approving an expense is a distinct capability from editing it.
  | "approve";

export interface SectorRole {
  sectorId: string;
  sectorSlug: string;
  sectorName: string;
  roleId: string;
  roleSlug: string;
  roleLevel: number;
  permissions: { resource: Resource; action: Action }[];
}

export interface UserPermissions {
  userId: string;
  isGlobalAdmin: boolean;
  sectorRoles: SectorRole[];
}

/**
 * Raw shape of a `user_sector_roles` row with its nested sector, role and
 * role-permission joins, as returned by the Supabase query builder. Used to
 * type the mapping into {@link SectorRole} without resorting to `any`.
 */
export interface SectorRoleRow {
  sector_id: string;
  role_id: string;
  sectors: { slug: string; name: string };
  roles: {
    slug: string;
    level: number;
    role_permissions: {
      permissions: { resource: Resource; action: Action } | null;
    }[];
  };
}

/** Maps a raw {@link SectorRoleRow} into the app-facing {@link SectorRole}. */
export function mapSectorRoleRow(row: SectorRoleRow): SectorRole {
  return {
    sectorId: row.sector_id,
    sectorSlug: row.sectors.slug,
    sectorName: row.sectors.name,
    roleId: row.role_id,
    roleSlug: row.roles.slug,
    roleLevel: row.roles.level,
    permissions: (row.roles.role_permissions ?? [])
      .map((rp) => rp.permissions)
      .filter((p): p is { resource: Resource; action: Action } => p !== null),
  };
}
