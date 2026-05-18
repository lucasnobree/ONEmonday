// Pure pt-BR formatting helpers for the Support Desk module.
// Kept free of React/Supabase so they can be unit tested in isolation.

/**
 * Human-readable, relative pt-BR timestamp ("agora", "5min atrás",
 * "3h atrás", "2d atrás"). Falls back to an absolute date once the value is
 * a week or more old.
 */
export function formatRelativeTime(
  dateStr: string,
  now: Date = new Date()
): string {
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  if (days < 7) return `${days}d atrás`;
  return date.toLocaleDateString("pt-BR");
}
