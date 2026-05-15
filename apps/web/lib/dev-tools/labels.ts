/**
 * pt-BR display labels and badge variants for Dev-Tools module enum values.
 * Centralised so the dashboard, lists and dialogs stay consistent.
 */
export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export const ENVIRONMENT_LABELS: Record<string, string> = {
  production: "Producao",
  staging: "Staging",
  development: "Desenvolvimento",
};

export const CRITICALITY_LABELS: Record<
  string,
  { label: string; variant: BadgeVariant }
> = {
  critical: { label: "Critico", variant: "destructive" },
  high: { label: "Alto", variant: "default" },
  medium: { label: "Medio", variant: "secondary" },
  low: { label: "Baixo", variant: "outline" },
};

export const HEALTH_LABELS: Record<
  string,
  { label: string; variant: BadgeVariant }
> = {
  operational: { label: "Operacional", variant: "default" },
  degraded: { label: "Degradado", variant: "secondary" },
  partial_outage: { label: "Interrupcao parcial", variant: "destructive" },
  major_outage: { label: "Interrupcao total", variant: "destructive" },
};

export const SEVERITY_LABELS: Record<
  string,
  { label: string; variant: BadgeVariant }
> = {
  sev1: { label: "SEV1 - Critico", variant: "destructive" },
  sev2: { label: "SEV2 - Alto", variant: "destructive" },
  sev3: { label: "SEV3 - Medio", variant: "secondary" },
  sev4: { label: "SEV4 - Baixo", variant: "outline" },
};

export const INCIDENT_STATUS_LABELS: Record<
  string,
  { label: string; variant: BadgeVariant }
> = {
  investigating: { label: "Investigando", variant: "destructive" },
  identified: { label: "Identificado", variant: "default" },
  monitoring: { label: "Monitorando", variant: "secondary" },
  resolved: { label: "Resolvido", variant: "outline" },
};

export const DEPLOYMENT_STATUS_LABELS: Record<
  string,
  { label: string; variant: BadgeVariant }
> = {
  pending: { label: "Pendente", variant: "secondary" },
  succeeded: { label: "Concluido", variant: "default" },
  failed: { label: "Falhou", variant: "destructive" },
  rolled_back: { label: "Revertido", variant: "outline" },
};
