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
  | "saved_view";

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
  | "deactivate";

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
