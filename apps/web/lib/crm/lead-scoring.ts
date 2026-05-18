/**
 * Rule-based lead scoring for the CRM Leads inbox.
 *
 * A lead's score is a simple, transparent sum of points awarded per criterion
 * — exactly the kind of "points by profile/behaviour" model RD Station
 * Marketing exposes (migration-comercial.md backlog #26), kept deliberately
 * simple: no behavioural tracking, no ML, just attribute rules a sales lead
 * can read and trust.
 *
 * The score drives the inbox sort (hottest first) and a hot/warm/cold band.
 * Scoring is computed in app code and persisted onto `crm_leads.score`, so a
 * lead is re-scored whenever it is captured or edited.
 */

/** The lead attributes the scoring rules look at. */
export interface ScorableLead {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source?: string | null;
  /** The custom-field payload submitted with the lead. */
  payload?: Record<string, unknown> | null;
}

/** One scoring rule that fired, with the points it contributed. */
export interface ScoreRuleHit {
  /** Stable rule id. */
  id: string;
  /** Human-readable pt-BR explanation. */
  label: string;
  /** Points contributed (may be 0 when the rule did not fire). */
  points: number;
  /** Whether the rule's condition was met. */
  matched: boolean;
}

/** The full scored result for a lead. */
export interface LeadScore {
  /** Total points, clamped to [0, MAX_LEAD_SCORE]. */
  score: number;
  /** Qualitative band derived from the score. */
  band: "hot" | "warm" | "cold";
  /** Every rule, in evaluation order, with whether it matched. */
  rules: ScoreRuleHit[];
}

/** The maximum a lead can score — the sum of all positive rule points. */
export const MAX_LEAD_SCORE = 100;

/** Score at/above which a lead is "hot". */
export const HOT_SCORE_THRESHOLD = 60;
/** Score at/above which a lead is "warm" (below this it is "cold"). */
export const WARM_SCORE_THRESHOLD = 30;

/**
 * Free, generic email domains. A lead using a corporate domain is worth more
 * than one using a free webmail address — a common B2B qualification signal.
 */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "yahoo.com.br",
  "live.com",
  "icloud.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "proton.me",
  "protonmail.com",
]);

/** Lead sources considered higher-intent than a passive form fill. */
const HIGH_INTENT_SOURCES = new Set([
  "referral",
  "indicacao",
  "demo",
  "demo_request",
  "contact_sales",
  "pricing",
]);

function nonEmpty(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Extracts the lowercased domain part of an email, or null. */
export function emailDomain(email: string | null | undefined): string | null {
  if (!nonEmpty(email)) return null;
  const at = email!.lastIndexOf("@");
  if (at < 0 || at === email!.length - 1) return null;
  return email!.slice(at + 1).trim().toLowerCase();
}

/** True when an email uses a corporate (non-free-webmail) domain. */
export function isCorporateEmail(email: string | null | undefined): boolean {
  const domain = emailDomain(email);
  return domain !== null && !FREE_EMAIL_DOMAINS.has(domain);
}

/**
 * Score a lead against the rule set. Pure and deterministic — the same lead
 * always yields the same score, which makes it trivially unit-testable and
 * safe to recompute on every edit.
 */
export function scoreLead(lead: ScorableLead): LeadScore {
  const payload = lead.payload ?? {};
  const payloadEntries = Object.values(payload).filter(
    (v) => v !== null && v !== undefined && String(v).trim() !== ""
  );

  const rules: ScoreRuleHit[] = [
    {
      id: "has-email",
      label: "Forneceu e-mail",
      points: 15,
      matched: nonEmpty(lead.email),
    },
    {
      id: "has-phone",
      label: "Forneceu telefone",
      points: 15,
      matched: nonEmpty(lead.phone),
    },
    {
      id: "has-company",
      label: "Informou empresa",
      points: 15,
      matched: nonEmpty(lead.company),
    },
    {
      id: "corporate-email",
      label: "E-mail corporativo (não webmail)",
      points: 25,
      matched: isCorporateEmail(lead.email),
    },
    {
      id: "high-intent-source",
      label: "Origem de alta intenção",
      points: 20,
      matched: HIGH_INTENT_SOURCES.has((lead.source ?? "").trim().toLowerCase()),
    },
    {
      id: "rich-payload",
      label: "Preencheu campos adicionais",
      points: 10,
      matched: payloadEntries.length >= 2,
    },
  ];

  const rawScore = rules.reduce(
    (sum, rule) => sum + (rule.matched ? rule.points : 0),
    0
  );
  const score = Math.max(0, Math.min(MAX_LEAD_SCORE, rawScore));

  return { score, band: scoreBand(score), rules };
}

/** Maps a numeric score to its qualitative band. */
export function scoreBand(score: number): LeadScore["band"] {
  if (score >= HOT_SCORE_THRESHOLD) return "hot";
  if (score >= WARM_SCORE_THRESHOLD) return "warm";
  return "cold";
}

/** pt-BR label for a score band. */
export function scoreBandLabel(band: LeadScore["band"]): string {
  switch (band) {
    case "hot":
      return "Quente";
    case "warm":
      return "Morno";
    case "cold":
      return "Frio";
  }
}

/**
 * A one-line, plain-language verdict for a score band — gives a non-analytical
 * SDR an actionable read of the lead instead of a bare number/badge.
 */
export function leadVerdict(band: LeadScore["band"]): string {
  switch (band) {
    case "hot":
      return "Lead quente — priorize o contato hoje.";
    case "warm":
      return "Lead morno — vale uma abordagem nos próximos dias.";
    case "cold":
      return "Lead frio — nutra antes de investir tempo de venda.";
  }
}
