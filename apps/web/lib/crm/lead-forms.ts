/**
 * Lead-capture form helpers — shared by the public submission API route, the
 * server actions and the form-builder UI.
 *
 * A capture form is a *field list* (the focused MVP, NOT a drag-and-drop
 * landing-page builder — see migration-comercial.md §5). This module turns a
 * stored form definition into the things downstream code needs:
 *   * `validateSubmission` — check a visitor's raw values against the form;
 *   * `mapSubmissionToLead` — turn validated values into the `crm_leads`
 *     name/email/phone/company + custom `payload` split.
 */
import type { LeadFormField } from "@/lib/validations/crm";

/** A stored lead-capture form, as the public path needs to see it. */
export interface LeadFormDefinition {
  id: string;
  sector_id: string;
  source: string;
  fields: LeadFormField[];
}

/** Outcome of validating a public submission against a form definition. */
export type SubmissionValidation =
  | { ok: true; values: Record<string, string> }
  | { ok: false; errors: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_RE = /^[+\d][\d\s()\-.]{6,}$/;

/**
 * Validate a visitor's raw submitted values against a form's field list.
 *
 * Enforces: required fields are present, emails look like emails, tel fields
 * look like phone numbers, select fields only accept a defined option, and
 * unknown keys are dropped (a submitter cannot inject arbitrary payload keys).
 */
export function validateSubmission(
  form: LeadFormDefinition,
  raw: Record<string, unknown>
): SubmissionValidation {
  const errors: Record<string, string> = {};
  const values: Record<string, string> = {};

  for (const field of form.fields) {
    const rawValue = raw[field.key];
    const value = typeof rawValue === "string" ? rawValue.trim() : "";

    if (!value) {
      if (field.required) {
        errors[field.key] = `${field.label} é obrigatório`;
      }
      continue;
    }

    if (field.type === "email" && !EMAIL_RE.test(value)) {
      errors[field.key] = `${field.label} deve ser um e-mail válido`;
      continue;
    }
    if (field.type === "tel" && !TEL_RE.test(value)) {
      errors[field.key] = `${field.label} deve ser um telefone válido`;
      continue;
    }
    if (
      field.type === "select" &&
      !(field.options ?? []).includes(value)
    ) {
      errors[field.key] = `${field.label}: opção inválida`;
      continue;
    }

    values[field.key] = value;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, values };
}

/** The lead-shaped result of mapping a validated submission. */
export interface MappedLead {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  /** Every other validated field, keyed by field key. */
  payload: Record<string, string>;
}

/** The structured lead columns a form field can feed. */
type MapTarget = "name" | "email" | "phone" | "company";

/** Conventional key fallbacks, used when a field carries no explicit `map`. */
const CONVENTIONAL_KEYS: Record<MapTarget, string[]> = {
  name: ["name", "nome", "full_name", "nome_completo"],
  email: ["email", "e_mail"],
  phone: ["phone", "telefone", "celular", "whatsapp"],
  company: ["company", "empresa", "organizacao"],
};

/**
 * Map validated submission values onto the `crm_leads` columns.
 *
 * A field can be **explicitly tagged** with `map: name|email|phone|company` in
 * the form builder — that field then feeds the matching structured column.
 * Fields with no `map` tag (or `map: 'none'`) fall back to the legacy
 * conventional-key matching (`nome`, `email`, `telefone`, `empresa`); anything
 * still unmatched lands in the free-form `payload`. Explicit mapping always
 * wins over the conventional fallback, so a sector can design any field list
 * and decide exactly which field populates which lead property.
 *
 * @param values  The validated key/value submission.
 * @param fields  The form's field definitions (carry the explicit `map` tag).
 *                Omitting them yields the legacy conventional-key behaviour.
 */
export function mapSubmissionToLead(
  values: Record<string, string>,
  fields: LeadFormField[] = []
): MappedLead {
  // 1. Explicit mapping — a field tagged `map: <target>` claims that target.
  const explicit: Partial<Record<MapTarget, string>> = {};
  const consumed = new Set<string>();
  for (const field of fields) {
    const target = field.map;
    if (!target || target === "none") continue;
    const value = values[field.key];
    if (value === undefined || value === "") continue;
    // First field wins if (defensively) two share a target.
    if (explicit[target] === undefined) {
      explicit[target] = value;
      consumed.add(field.key);
    }
  }

  // 2. Conventional-key fallback for any target an explicit map left unset.
  const resolve = (target: MapTarget): string | null => {
    if (explicit[target] !== undefined) return explicit[target] as string;
    for (const key of CONVENTIONAL_KEYS[target]) {
      const value = values[key];
      if (value !== undefined && value !== "") {
        consumed.add(key);
        return value;
      }
    }
    return null;
  };

  const name = resolve("name");
  const email = resolve("email");
  const phone = resolve("phone");
  const company = resolve("company");

  // 3. Everything not consumed by a structured column stays in `payload`.
  const payload: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!consumed.has(key)) payload[key] = value;
  }

  return {
    name: name ?? "Lead sem nome",
    email,
    phone,
    company,
    payload,
  };
}
