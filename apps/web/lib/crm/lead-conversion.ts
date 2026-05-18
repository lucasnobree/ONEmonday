/**
 * Lead -> CRM conversion mapping.
 *
 * Qualifying a lead in the inbox converts it into the real CRM entities:
 * a `crm_contacts` row and a `crm_deals` row (which itself rides a `cards`
 * row on the pipeline board). This module holds the *pure* mapping logic —
 * how a raw lead's fields translate into contact / deal / card inserts — so
 * the rules are unit-testable independently of Supabase.
 *
 * The server action (lib/actions/crm/leads.ts) calls these builders and then
 * performs the writes.
 */

/** The lead fields conversion reads. */
export interface ConvertibleLead {
  id: string;
  sector_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source?: string | null;
  score?: number | null;
}

/** Insert payload for the `crm_companies` row, when the lead names a company. */
export interface CompanyInsert {
  sector_id: string;
  name: string;
}

/** Insert payload for the `crm_contacts` row. */
export interface ContactInsert {
  sector_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
}

/** Insert payload for the pipeline `cards` row a deal rides on. */
export interface CardInsert {
  title: string;
  sector_id: string;
  priority: "critical" | "high" | "medium" | "low";
}

/** Insert payload for the `crm_deals` row. */
export interface DealInsert {
  sector_id: string;
  value: number | null;
  currency: string;
  source: string;
  win_probability: number | null;
}

/** The complete set of inserts a conversion produces. */
export interface ConversionPlan {
  /** Null when the lead carried no company name. */
  company: CompanyInsert | null;
  contact: ContactInsert;
  card: CardInsert;
  deal: DealInsert;
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Map a lead's score to a starting deal win-probability. A hotter lead opens
 * its deal with more confidence — a small, defensible default the salesperson
 * can override later.
 */
export function probabilityFromScore(score: number | null | undefined): number {
  const s = typeof score === "number" && score > 0 ? score : 0;
  if (s >= 60) return 30;
  if (s >= 30) return 20;
  return 10;
}

/**
 * Map a lead's score to a starting card priority — a hot lead lands as a
 * high-priority card so it surfaces at the top of the pipeline column.
 */
export function priorityFromScore(
  score: number | null | undefined
): CardInsert["priority"] {
  const s = typeof score === "number" && score > 0 ? score : 0;
  if (s >= 60) return "high";
  if (s >= 30) return "medium";
  return "low";
}

/**
 * Build the full conversion plan for a lead.
 *
 * @param lead         The lead being qualified.
 * @param dealValue    Optional deal value the salesperson entered at qualify
 *                     time (null = unknown, fill in later).
 * @param currency     Deal currency (defaults BRL).
 */
export function planLeadConversion(
  lead: ConvertibleLead,
  dealValue: number | null = null,
  currency = "BRL"
): ConversionPlan {
  const companyName = clean(lead.company);
  const contactName = clean(lead.name) ?? "Lead sem nome";

  const company: CompanyInsert | null = companyName
    ? { sector_id: lead.sector_id, name: companyName }
    : null;

  const contact: ContactInsert = {
    sector_id: lead.sector_id,
    full_name: contactName,
    email: clean(lead.email),
    phone: clean(lead.phone),
    is_primary: true,
  };

  // The deal card title: prefer the company, fall back to the contact name.
  const dealTitle = companyName
    ? `${companyName} — ${contactName}`
    : contactName;

  const card: CardInsert = {
    title: dealTitle,
    sector_id: lead.sector_id,
    priority: priorityFromScore(lead.score),
  };

  const deal: DealInsert = {
    sector_id: lead.sector_id,
    value: typeof dealValue === "number" && dealValue >= 0 ? dealValue : null,
    currency,
    // Stamp the deal source from the lead so campaign attribution survives.
    source: clean(lead.source) ?? "lead",
    win_probability: probabilityFromScore(lead.score),
  };

  return { company, contact, card, deal };
}
