/**
 * Presentation helpers for the Leads inbox — kept out of the scoring core so
 * `lead-scoring.ts` stays pure domain logic with no Tailwind coupling.
 */
import { scoreBand } from "@/lib/crm/lead-scoring";
import type { LeadStatus } from "@/lib/validations/crm";

/** Tailwind classes for a score badge, coloured by the score's band. */
export function leadBandClass(score: number): string {
  switch (scoreBand(score)) {
    case "hot":
      return "bg-red-100 text-red-700 hover:bg-red-100";
    case "warm":
      return "bg-amber-100 text-amber-700 hover:bg-amber-100";
    case "cold":
      return "bg-slate-100 text-slate-600 hover:bg-slate-100";
  }
}

/** pt-BR label for a lead triage status. */
export function leadStatusLabel(status: LeadStatus): string {
  switch (status) {
    case "new":
      return "Novo";
    case "working":
      return "Em trabalho";
    case "qualified":
      return "Qualificado";
    case "discarded":
      return "Descartado";
  }
}

/** shadcn Badge variant for a lead triage status. */
export function leadStatusVariant(
  status: LeadStatus
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "new":
      return "default";
    case "working":
      return "secondary";
    case "qualified":
      return "outline";
    case "discarded":
      return "destructive";
  }
}
