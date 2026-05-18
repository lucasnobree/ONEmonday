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

/**
 * Map validated submission values onto the `crm_leads` columns.
 *
 * A form's fields are matched to the structured lead columns by a small set of
 * conventional keys (`name`/`nome`, `email`, `phone`/`telefone`, `company`/
 * `empresa`); everything else goes into the free-form `payload`. This lets a
 * sector design any field list while still populating the columns the inbox
 * and conversion rely on.
 */
export function mapSubmissionToLead(
  values: Record<string, string>
): MappedLead {
  const NAME_KEYS = ["name", "nome", "full_name", "nome_completo"];
  const EMAIL_KEYS = ["email", "e_mail"];
  const PHONE_KEYS = ["phone", "telefone", "celular", "whatsapp"];
  const COMPANY_KEYS = ["company", "empresa", "organizacao"];

  const pick = (keys: string[]): { key: string; value: string } | null => {
    for (const key of keys) {
      if (values[key] !== undefined && values[key] !== "") {
        return { key, value: values[key] };
      }
    }
    return null;
  };

  const name = pick(NAME_KEYS);
  const email = pick(EMAIL_KEYS);
  const phone = pick(PHONE_KEYS);
  const company = pick(COMPANY_KEYS);

  const consumed = new Set(
    [name, email, phone, company]
      .filter((m): m is { key: string; value: string } => m !== null)
      .map((m) => m.key)
  );

  const payload: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!consumed.has(key)) payload[key] = value;
  }

  return {
    name: name?.value ?? "Lead sem nome",
    email: email?.value ?? null,
    phone: phone?.value ?? null,
    company: company?.value ?? null,
    payload,
  };
}
