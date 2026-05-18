/**
 * OFX statement parser — the manual bank-reconciliation fallback.
 *
 * The recommended bank feed is the Pluggy Open Finance adapter
 * (lib/integrations/banking/pluggy-adapter.ts). When no aggregator credential
 * exists, a finance user can still reconcile by uploading the OFX file their
 * bank exports — this parser turns that file into the same
 * {@link BankTransaction} shape the Pluggy adapter produces, so the
 * reconciliation UI is source-agnostic (migration-contabilidade.md backlog #2).
 *
 * OFX is an SGML-ish format. This is a deliberately small, dependency-free
 * tag-scanner that reads only the `<STMTTRN>` records needed for
 * reconciliation — it is not a full OFX validator. Pure function, fully
 * testable.
 */
import type { BankTransaction } from "@/lib/integrations/finance-types";
import { parseCents } from "@/lib/finance/money";

/** Reads the text content of the first `<TAG>` inside `block`. */
function tagValue(block: string, tag: string): string | null {
  // OFX values run from the tag to the next tag or newline (no close tag).
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i");
  const match = re.exec(block);
  return match ? match[1].trim() : null;
}

/**
 * Parses an OFX `DTPOSTED` value (e.g. `20260510`, `20260510120000[-3:BRT]`)
 * into a date-only `YYYY-MM-DD` string. Returns null when unparseable.
 */
export function parseOfxDate(raw: string | null): string | null {
  if (!raw) return null;
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * Parses an OFX `<TRNAMT>` value into integer cents plus a direction.
 * OFX signs the amount (negative = debit). Returns null when unparseable or
 * zero.
 *
 * The magnitude is parsed by `parseCents` (money.ts) so pt-BR grouped amounts
 * (`1.500,00`) and en-US amounts (`1,500.00`) are both handled correctly — a
 * naive `","->"."` replace would turn `1.500,00` into the broken `1.500.00`.
 * The leading sign is stripped first because `parseCents` rejects negatives.
 */
export function parseOfxAmount(
  raw: string | null
): { amountCents: number; direction: "credit" | "debit" } | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\s/g, "");
  if (trimmed === "") return null;
  const negative = trimmed.startsWith("-");
  // Strip a leading +/- sign; the magnitude alone goes to parseCents.
  const magnitude = trimmed.replace(/^[+-]/, "");
  const amountCents = parseCents(magnitude);
  if (amountCents === null || amountCents === 0) return null;
  return {
    amountCents,
    direction: negative ? "debit" : "credit",
  };
}

/**
 * Parses an OFX statement string into {@link BankTransaction} rows. Reads every
 * `<STMTTRN>` block; a block missing a usable id, amount or date is skipped.
 * The OFX `FITID` becomes the dedup `externalId`.
 */
export function parseOfx(ofx: string): BankTransaction[] {
  if (typeof ofx !== "string" || ofx.length === 0) return [];

  const transactions: BankTransaction[] = [];
  // Match each <STMTTRN>...</STMTTRN> record (case-insensitive, dot-all).
  const blockRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let block: RegExpExecArray | null;

  while ((block = blockRe.exec(ofx)) !== null) {
    const body = block[1];
    const fitid = tagValue(body, "FITID");
    const amount = parseOfxAmount(tagValue(body, "TRNAMT"));
    const postedDate = parseOfxDate(tagValue(body, "DTPOSTED"));
    if (!fitid || !amount || !postedDate) continue;

    transactions.push({
      externalId: fitid,
      direction: amount.direction,
      amountCents: amount.amountCents,
      currency: "BRL",
      postedDate,
      description:
        tagValue(body, "MEMO") ?? tagValue(body, "NAME") ?? "",
    });
  }

  return transactions;
}
