/**
 * Message-template variable substitution for the deal Communication panel.
 *
 * A `crm_message_templates` body may carry `{{variable}}` placeholders. When a
 * rep picks a template, these helpers substitute the placeholders from the
 * linked contact / company / deal so the rep starts from a personalised draft
 * instead of a blank textarea.
 *
 * Kept pure (no React, no Supabase) so the substitution rules are unit-testable.
 */

/** The merge-field values a deal context can supply. */
export interface TemplateContext {
  /** Linked contact's full name. */
  contactName?: string | null;
  /** Linked contact's first name (derived when only the full name is known). */
  contactFirstName?: string | null;
  /** Linked company's name. */
  companyName?: string | null;
  /** The deal's title. */
  dealTitle?: string | null;
  /** The sending user's display name. */
  userName?: string | null;
}

/**
 * The supported merge fields, mapped to their `TemplateContext` key. Both a
 * pt-BR token and an English alias resolve to the same value so a sector can
 * write whichever reads naturally.
 */
const VARIABLE_MAP: Record<string, keyof TemplateContext> = {
  // pt-BR tokens
  "contato.nome": "contactName",
  "contato.primeiro_nome": "contactFirstName",
  "empresa.nome": "companyName",
  "deal.titulo": "dealTitle",
  "usuario.nome": "userName",
  // English aliases
  "contact.name": "contactName",
  "contact.first_name": "contactFirstName",
  "company.name": "companyName",
  "deal.title": "dealTitle",
  "user.name": "userName",
};

/** Every recognised `{{token}}` a template body may use, for the builder hint. */
export const TEMPLATE_VARIABLES = Object.keys(VARIABLE_MAP);

/** First word of a full name, trimmed. Empty input yields an empty string. */
export function firstName(fullName: string | null | undefined): string {
  if (typeof fullName !== "string") return "";
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/**
 * Substitute every `{{variable}}` placeholder in `body` from `context`.
 *
 * - Whitespace inside the braces is tolerated (`{{ contato.nome }}`).
 * - An unknown variable, or a known one with no value in the context, is
 *   replaced with an empty string — a draft never ships a literal `{{token}}`.
 * - `contato.primeiro_nome` falls back to the first word of `contactName`
 *   when no explicit first name was supplied.
 */
export function renderTemplate(
  body: string,
  context: TemplateContext
): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, token: string) => {
    const key = VARIABLE_MAP[token];
    if (!key) return "";

    if (key === "contactFirstName") {
      const explicit = context.contactFirstName;
      if (explicit && explicit.trim()) return explicit.trim();
      return firstName(context.contactName);
    }

    const value = context[key];
    return value ? String(value).trim() : "";
  });
}
