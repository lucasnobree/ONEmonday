import type {
  MarketingChannel,
  CampaignStatus,
  ContentStatus,
} from "@/lib/validations/marketing";

/** Portuguese display labels for marketing channels. */
export const CHANNEL_LABELS: Record<MarketingChannel, string> = {
  email: "E-mail",
  social: "Redes Sociais",
  paid_ads: "Mídia Paga",
  content: "Conteúdo",
  event: "Eventos",
  seo: "SEO",
  other: "Outros",
};

/** Chart-friendly hex colors per channel (shared by recharts visuals). */
export const CHANNEL_COLORS: Record<MarketingChannel, string> = {
  email: "#6366f1",
  social: "#ec4899",
  paid_ads: "#f59e0b",
  content: "#10b981",
  event: "#06b6d4",
  seo: "#8b5cf6",
  other: "#94a3b8",
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  active: "Ativa",
  paused: "Pausada",
  completed: "Concluída",
  cancelled: "Cancelada",
};

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  idea: "Ideia",
  draft: "Rascunho",
  scheduled: "Agendado",
  published: "Publicado",
  cancelled: "Cancelado",
};

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export const CAMPAIGN_STATUS_VARIANTS: Record<CampaignStatus, BadgeVariant> = {
  draft: "outline",
  scheduled: "secondary",
  active: "default",
  paused: "secondary",
  completed: "default",
  cancelled: "destructive",
};

export const CONTENT_STATUS_VARIANTS: Record<ContentStatus, BadgeVariant> = {
  idea: "outline",
  draft: "outline",
  scheduled: "secondary",
  published: "default",
  cancelled: "destructive",
};
