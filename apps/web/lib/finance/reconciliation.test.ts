import { describe, it, expect } from "vitest";
import {
  matchTransaction,
  suggestReconciliation,
  autoMatchableCount,
  type ReconcileCandidate,
} from "./reconciliation";
import type { BankTransaction } from "@/lib/integrations/finance-types";

function tx(over: Partial<BankTransaction>): BankTransaction {
  return {
    externalId: "TX",
    direction: "credit",
    amountCents: 100_000,
    currency: "BRL",
    postedDate: "2026-05-10",
    description: "",
    ...over,
  };
}

function invoiceCandidate(over: Partial<ReconcileCandidate>): ReconcileCandidate {
  return {
    id: "inv1",
    kind: "invoice",
    amountCents: 100_000,
    referenceDate: "2026-05-08",
    partyName: "Cliente",
    ...over,
  };
}

describe("matchTransaction", () => {
  it("matches a credit to an invoice of equal amount within tolerance", () => {
    const result = matchTransaction(tx({}), [invoiceCandidate({})]);
    expect(result.confidence).toBe("high");
    expect(result.candidates[0].id).toBe("inv1");
  });

  it("does not match an expense to a credit transaction", () => {
    const result = matchTransaction(tx({ direction: "credit" }), [
      invoiceCandidate({ kind: "expense", id: "exp1" }),
    ]);
    expect(result.confidence).toBe("none");
  });

  it("matches a debit to an expense", () => {
    const result = matchTransaction(tx({ direction: "debit" }), [
      invoiceCandidate({ kind: "expense", id: "exp1" }),
    ]);
    expect(result.confidence).toBe("high");
    expect(result.candidates[0].kind).toBe("expense");
  });

  it("rejects an amount mismatch", () => {
    const result = matchTransaction(tx({ amountCents: 100_000 }), [
      invoiceCandidate({ amountCents: 99_999 }),
    ]);
    expect(result.confidence).toBe("none");
  });

  it("rejects a date outside the tolerance window", () => {
    const result = matchTransaction(tx({ postedDate: "2026-05-10" }), [
      invoiceCandidate({ referenceDate: "2026-04-01" }),
    ]);
    expect(result.confidence).toBe("none");
  });

  it("returns low confidence with several candidates, closest date first", () => {
    const result = matchTransaction(tx({ postedDate: "2026-05-10" }), [
      invoiceCandidate({ id: "far", referenceDate: "2026-05-06" }),
      invoiceCandidate({ id: "near", referenceDate: "2026-05-09" }),
    ]);
    expect(result.confidence).toBe("low");
    expect(result.candidates[0].id).toBe("near");
    expect(result.candidates[1].id).toBe("far");
  });
});

describe("suggestReconciliation", () => {
  it("does not let two transactions claim the same candidate", () => {
    const transactions = [
      tx({ externalId: "T1", postedDate: "2026-05-10" }),
      tx({ externalId: "T2", postedDate: "2026-05-10" }),
    ];
    const candidates = [invoiceCandidate({ id: "only", referenceDate: "2026-05-10" })];
    const suggestions = suggestReconciliation(transactions, candidates);
    expect(suggestions[0].confidence).toBe("high");
    expect(suggestions[0].candidates[0].id).toBe("only");
    // The single candidate was claimed by T1 — T2 has nothing left.
    expect(suggestions[1].confidence).toBe("none");
  });

  it("matches independent transactions to their own candidates", () => {
    const transactions = [
      tx({ externalId: "T1", amountCents: 100_000 }),
      tx({ externalId: "T2", amountCents: 200_000 }),
    ];
    const candidates = [
      invoiceCandidate({ id: "a", amountCents: 100_000 }),
      invoiceCandidate({ id: "b", amountCents: 200_000 }),
    ];
    const suggestions = suggestReconciliation(transactions, candidates);
    expect(autoMatchableCount(suggestions)).toBe(2);
  });
});

describe("autoMatchableCount", () => {
  it("counts only high-confidence suggestions", () => {
    const suggestions = suggestReconciliation(
      [tx({ externalId: "T1" }), tx({ externalId: "T2", amountCents: 7 })],
      [invoiceCandidate({})]
    );
    expect(autoMatchableCount(suggestions)).toBe(1);
  });
});
