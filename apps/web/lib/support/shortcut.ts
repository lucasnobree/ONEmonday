// Pure helpers for canned-response shortcuts.
// Kept free of Supabase/React so they can be unit tested in isolation.

/**
 * Normalizes a shortcut for storage: trims whitespace and removes every
 * leading slash. The badge UI renders shortcuts as `/{shortcut}`, so a
 * stored value of `/escalar` (or `//escalar`) would display as `//escalar`.
 * Storing the bare token (`escalar`) keeps display consistently single-slash.
 *
 * Returns `undefined` when the result is empty so the optional column stays
 * null rather than being written as an empty string.
 */
export function normalizeShortcut(
  raw: string | null | undefined
): string | undefined {
  if (raw == null) return undefined;
  const cleaned = raw.trim().replace(/^\/+/, "").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Formats a (possibly already slash-prefixed) shortcut for display, always
 * producing exactly one leading slash. Defensive against legacy rows whose
 * stored value still contains a leading slash.
 */
export function formatShortcut(raw: string | null | undefined): string {
  const normalized = normalizeShortcut(raw);
  return normalized ? `/${normalized}` : "";
}
