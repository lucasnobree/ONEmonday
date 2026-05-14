export const PRIORITY_CONFIG = {
  critical: { label: "Critico", color: "red", badgeVariant: "destructive" },
  high: { label: "Alta", color: "orange", badgeVariant: "default" },
  medium: { label: "Media", color: "yellow", badgeVariant: "secondary" },
  low: { label: "Baixa", color: "green", badgeVariant: "outline" },
} as const;

export type Priority = keyof typeof PRIORITY_CONFIG;

export const PRIORITY_BORDER_COLORS: Record<Priority, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-yellow-500",
  low: "border-l-green-500",
};

export function formatDateShort(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function formatDateFull(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
