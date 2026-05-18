/**
 * Recipient-list parsing for the e-mail composer (Wave 5).
 *
 * Used both by the campaign send dialog (manual recipient textarea) and the
 * audience-segment contact editor. Parses a free-text block of `email` or
 * `Name <email>` lines, validates each address, and de-duplicates — so the UI
 * can surface "N válidos · M inválidos" instead of silently passing a bad
 * address to the server (audit finding W4).
 */

/** A parsed recipient row. */
export interface ParsedRecipient {
  email: string;
  name?: string;
}

/** The outcome of parsing a recipient text block. */
export interface ParseRecipientsResult {
  /** Unique, well-formed recipients (de-duplicated case-insensitively). */
  valid: ParsedRecipient[];
  /** Raw lines that did not contain a well-formed e-mail address. */
  invalid: string[];
  /** Count of duplicate lines dropped during de-duplication. */
  duplicates: number;
}

/**
 * Pragmatic e-mail check — `local@domain.tld` with no spaces. It deliberately
 * mirrors what the server-side Zod `email()` accepts closely enough to stop a
 * correct-looking count followed by a server rejection; the server remains the
 * source of truth.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when `value` is a well-formed e-mail address. */
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

/**
 * Parses a textarea block of `email` or `Name <email>` lines (newline-, comma-
 * or semicolon-separated) into a validated, de-duplicated recipient list.
 */
export function parseRecipients(raw: string): ParseRecipientsResult {
  const valid: ParsedRecipient[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  const lines = raw
    .split(/[\n,;]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    const match = line.match(/^(.*?)<(.+?)>$/);
    const email = (match ? match[2] : line).trim();
    const name = match ? match[1].trim() || undefined : undefined;

    if (!isValidEmail(email)) {
      invalid.push(line);
      continue;
    }

    const key = email.toLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    valid.push(name ? { email, name } : { email });
  }

  return { valid, invalid, duplicates };
}
