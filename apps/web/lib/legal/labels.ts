/**
 * pt-BR display labels and badge variants for Legal module enum values.
 * Centralised so the dashboard, lists and dialogs stay consistent.
 */
import type { RenewalStatus } from "./renewal";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  service: "Serviço",
  nda: "NDA",
  vendor: "Fornecedor",
  employment: "Trabalhista",
  lease: "Locação",
  license: "Licença",
  partnership: "Parceria",
  other: "Outro",
};

export const CONTRACT_STATUS_LABELS: Record<
  string,
  { label: string; variant: BadgeVariant }
> = {
  draft: { label: "Rascunho", variant: "outline" },
  in_review: { label: "Em revisão", variant: "secondary" },
  approved: { label: "Aprovado", variant: "secondary" },
  active: { label: "Ativo", variant: "default" },
  expired: { label: "Vencido", variant: "destructive" },
  renewed: { label: "Renovado", variant: "default" },
  terminated: { label: "Encerrado", variant: "destructive" },
};

export const RENEWAL_TYPE_LABELS: Record<string, string> = {
  none: "Sem renovação",
  auto: "Renovação automática",
  optional: "Renovação opcional",
};

export const RENEWAL_STATUS_LABELS: Record<
  RenewalStatus,
  { label: string; variant: BadgeVariant }
> = {
  none: { label: "Sem prazo", variant: "outline" },
  ok: { label: "Em dia", variant: "secondary" },
  upcoming: { label: "Renovação próxima", variant: "secondary" },
  notice: { label: "Ação necessária", variant: "destructive" },
  expired: { label: "Vencido", variant: "destructive" },
};

export const MATTER_TYPE_LABELS: Record<string, string> = {
  contract_review: "Revisão de contrato",
  advice: "Consultoria",
  dispute: "Disputa",
  compliance: "Compliance",
  litigation: "Litígio",
  other: "Outro",
};

export const MATTER_PRIORITY_LABELS: Record<
  string,
  { label: string; variant: BadgeVariant }
> = {
  low: { label: "Baixa", variant: "outline" },
  medium: { label: "Média", variant: "secondary" },
  high: { label: "Alta", variant: "default" },
  urgent: { label: "Urgente", variant: "destructive" },
};

export const MATTER_STATUS_LABELS: Record<
  string,
  { label: string; variant: BadgeVariant }
> = {
  open: { label: "Aberta", variant: "default" },
  in_progress: { label: "Em andamento", variant: "secondary" },
  blocked: { label: "Bloqueada", variant: "destructive" },
  resolved: { label: "Resolvida", variant: "secondary" },
  closed: { label: "Fechada", variant: "outline" },
};

export const CLAUSE_CATEGORY_LABELS: Record<string, string> = {
  general: "Geral",
  confidentiality: "Confidencialidade",
  liability: "Responsabilidade",
  payment: "Pagamento",
  termination: "Rescisão",
  ip: "Propriedade intelectual",
  compliance: "Compliance",
  other: "Outro",
};

/**
 * pt-BR label for how many contracts a clause is linked to, e.g.
 * "Não usada em contratos", "Usada em 1 contrato", "Usada em 3 contratos".
 */
export function clauseUsageLabel(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return "Não usada em contratos";
  if (n === 1) return "Usada em 1 contrato";
  return `Usada em ${n} contratos`;
}

/** Formats a monetary amount in pt-BR for the given ISO currency code. */
export function formatCurrency(
  amount: number | null,
  currency: string
): string {
  if (amount === null) return "-";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    // Unknown currency code — fall back to a plain number with the code.
    return `${currency} ${amount.toLocaleString("pt-BR")}`;
  }
}

/**
 * Formats a byte count as a human-readable file size (B / KB / MB), pt-BR
 * style. Used for contract document listings.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1).replace(".", ",")} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1).replace(".", ",")} MB`;
}
