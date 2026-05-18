import { describe, it, expect } from "vitest";
import {
  FISCAL_DOC_STATUS_LABELS,
  CHARGE_STATUS_LABELS,
} from "./labels";
import type { FiscalDocStatus } from "@/hooks/finance/use-fiscal-documents";
import type { ChargeStatus } from "@/hooks/finance/use-payment-charges";

/**
 * Regression: the Wave 4 UX audit flagged the fiscal/charge dialog rendering
 * raw English enum tokens (`authorized`, `pending`, `received`, `error`)
 * directly as badge text. These maps must cover every enum member with a
 * pt-BR label so nothing leaks untranslated.
 */
describe("FISCAL_DOC_STATUS_LABELS", () => {
  const allStatuses: FiscalDocStatus[] = [
    "draft",
    "processing",
    "authorized",
    "rejected",
    "cancelled",
    "error",
  ];

  it("has a pt-BR label for every fiscal-document status", () => {
    for (const status of allStatuses) {
      expect(FISCAL_DOC_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it("translates the tokens the audit flagged", () => {
    expect(FISCAL_DOC_STATUS_LABELS.authorized).toBe("Autorizada");
    expect(FISCAL_DOC_STATUS_LABELS.error).toBe("Erro");
  });

  it("never leaves a label equal to its raw English token", () => {
    for (const status of allStatuses) {
      expect(FISCAL_DOC_STATUS_LABELS[status]).not.toBe(status);
    }
  });
});

describe("CHARGE_STATUS_LABELS", () => {
  const allStatuses: ChargeStatus[] = [
    "draft",
    "pending",
    "received",
    "overdue",
    "cancelled",
    "error",
  ];

  it("has a pt-BR label for every charge status", () => {
    for (const status of allStatuses) {
      expect(CHARGE_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it("translates the tokens the audit flagged", () => {
    expect(CHARGE_STATUS_LABELS.pending).toBe("Pendente");
    expect(CHARGE_STATUS_LABELS.received).toBe("Recebida");
  });

  it("never leaves a label equal to its raw English token", () => {
    for (const status of allStatuses) {
      expect(CHARGE_STATUS_LABELS[status]).not.toBe(status);
    }
  });
});
