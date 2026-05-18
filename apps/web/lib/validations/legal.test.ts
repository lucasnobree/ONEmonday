import { describe, it, expect } from "vitest";
import {
  createContractSchema,
  updateContractSchema,
  createMatterSchema,
  createClauseSchema,
  createContractDocumentSchema,
  linkClauseSchema,
} from "./legal";

const SECTOR = "11111111-1111-4111-8111-111111111111";
const CONTRACT = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const CLAUSE = "44444444-4444-4444-8444-444444444444";

describe("createContractSchema", () => {
  const base = {
    sectorId: SECTOR,
    title: "Contrato de servico",
    counterparty: "Acme Ltda",
  };

  it("accepts a minimal valid contract", () => {
    expect(createContractSchema.safeParse(base).success).toBe(true);
  });

  it("applies the documented defaults", () => {
    const parsed = createContractSchema.parse(base);
    expect(parsed.contractType).toBe("service");
    expect(parsed.status).toBe("draft");
    expect(parsed.renewalType).toBe("none");
    expect(parsed.noticePeriodDays).toBe(30);
    expect(parsed.currency).toBe("BRL");
  });

  it("rejects a blank title", () => {
    expect(
      createContractSchema.safeParse({ ...base, title: "" }).success
    ).toBe(false);
  });

  it("rejects a blank counterparty", () => {
    expect(
      createContractSchema.safeParse({ ...base, counterparty: "" }).success
    ).toBe(false);
  });

  it("rejects an unknown contract type", () => {
    expect(
      createContractSchema.safeParse({ ...base, contractType: "barter" })
        .success
    ).toBe(false);
  });

  it("rejects a negative notice period", () => {
    expect(
      createContractSchema.safeParse({ ...base, noticePeriodDays: -1 }).success
    ).toBe(false);
  });

  it("rejects a negative contract value", () => {
    expect(
      createContractSchema.safeParse({ ...base, valueAmount: -100 }).success
    ).toBe(false);
  });

  it("accepts a valid effective/expiry date pair", () => {
    expect(
      createContractSchema.safeParse({
        ...base,
        effectiveDate: "2026-01-01",
        expiryDate: "2026-12-31",
      }).success
    ).toBe(true);
  });

  it("rejects an expiry date earlier than the effective date", () => {
    const result = createContractSchema.safeParse({
      ...base,
      effectiveDate: "2026-12-31",
      expiryDate: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("accepts equal effective and expiry dates", () => {
    expect(
      createContractSchema.safeParse({
        ...base,
        effectiveDate: "2026-06-01",
        expiryDate: "2026-06-01",
      }).success
    ).toBe(true);
  });

  it("rejects a malformed date string", () => {
    expect(
      createContractSchema.safeParse({ ...base, expiryDate: "31/12/2026" })
        .success
    ).toBe(false);
  });

  it("accepts a valid owner id", () => {
    const result = createContractSchema.safeParse({ ...base, ownerId: USER });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ownerId).toBe(USER);
  });

  it("rejects a non-uuid owner id", () => {
    expect(
      createContractSchema.safeParse({ ...base, ownerId: "someone" }).success
    ).toBe(false);
  });

  it("treats a contract with no owner as valid (owner is optional)", () => {
    const result = createContractSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ownerId).toBeUndefined();
  });
});

describe("updateContractSchema", () => {
  const base = {
    id: CONTRACT,
    sectorId: SECTOR,
    title: "Contrato",
    counterparty: "Acme",
  };

  it("requires a uuid id", () => {
    expect(updateContractSchema.safeParse(base).success).toBe(true);
    expect(
      updateContractSchema.safeParse({ ...base, id: "not-a-uuid" }).success
    ).toBe(false);
  });

  it("still enforces the date ordering rule", () => {
    expect(
      updateContractSchema.safeParse({
        ...base,
        effectiveDate: "2026-12-31",
        expiryDate: "2026-01-01",
      }).success
    ).toBe(false);
  });
});

describe("createMatterSchema", () => {
  const base = {
    sectorId: SECTOR,
    title: "Revisar contrato",
  };

  it("accepts a minimal valid matter with defaults", () => {
    const parsed = createMatterSchema.parse(base);
    expect(parsed.matterType).toBe("contract_review");
    expect(parsed.priority).toBe("medium");
    expect(parsed.status).toBe("open");
  });

  it("rejects an unknown priority", () => {
    expect(
      createMatterSchema.safeParse({ ...base, priority: "blocker" }).success
    ).toBe(false);
  });

  it("rejects a non-uuid related contract id", () => {
    expect(
      createMatterSchema.safeParse({ ...base, contractId: "abc" }).success
    ).toBe(false);
  });

  it("accepts a valid related contract id", () => {
    expect(
      createMatterSchema.safeParse({ ...base, contractId: CONTRACT }).success
    ).toBe(true);
  });

  it("accepts a valid assignee id", () => {
    const result = createMatterSchema.safeParse({ ...base, assignedTo: USER });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.assignedTo).toBe(USER);
  });

  it("rejects a non-uuid assignee id", () => {
    expect(
      createMatterSchema.safeParse({ ...base, assignedTo: "nobody" }).success
    ).toBe(false);
  });

  it("treats a matter with no assignee as valid (assignee is optional)", () => {
    const result = createMatterSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.assignedTo).toBeUndefined();
  });
});

describe("createClauseSchema", () => {
  const base = {
    sectorId: SECTOR,
    title: "Confidencialidade",
    body: "As partes se comprometem a manter sigilo.",
  };

  it("accepts a valid clause and defaults isApproved to false", () => {
    const parsed = createClauseSchema.parse(base);
    expect(parsed.isApproved).toBe(false);
    expect(parsed.category).toBe("general");
  });

  it("rejects an empty body", () => {
    expect(
      createClauseSchema.safeParse({ ...base, body: "" }).success
    ).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(
      createClauseSchema.safeParse({ ...base, category: "pricing" }).success
    ).toBe(false);
  });
});

describe("createContractDocumentSchema", () => {
  const base = {
    contractId: CONTRACT,
    filePath: "sector/contract/123-arquivo.pdf",
    fileName: "arquivo.pdf",
    fileSize: 1024,
  };

  it("accepts a valid document payload", () => {
    const parsed = createContractDocumentSchema.parse(base);
    expect(parsed.contractId).toBe(CONTRACT);
    expect(parsed.fileSize).toBe(1024);
  });

  it("rejects a non-uuid contract id", () => {
    expect(
      createContractDocumentSchema.safeParse({ ...base, contractId: "x" })
        .success
    ).toBe(false);
  });

  it("rejects an empty file path or name", () => {
    expect(
      createContractDocumentSchema.safeParse({ ...base, filePath: "" }).success
    ).toBe(false);
    expect(
      createContractDocumentSchema.safeParse({ ...base, fileName: "" }).success
    ).toBe(false);
  });

  it("rejects a negative file size", () => {
    expect(
      createContractDocumentSchema.safeParse({ ...base, fileSize: -1 }).success
    ).toBe(false);
  });

  it("accepts an optional label and mime type", () => {
    const result = createContractDocumentSchema.safeParse({
      ...base,
      mimeType: "application/pdf",
      docLabel: "Versão assinada",
    });
    expect(result.success).toBe(true);
  });
});

describe("linkClauseSchema", () => {
  it("accepts a valid contract+clause pair", () => {
    const parsed = linkClauseSchema.parse({
      contractId: CONTRACT,
      clauseId: CLAUSE,
    });
    expect(parsed.contractId).toBe(CONTRACT);
    expect(parsed.clauseId).toBe(CLAUSE);
  });

  it("rejects a non-uuid clause id", () => {
    expect(
      linkClauseSchema.safeParse({ contractId: CONTRACT, clauseId: "nope" })
        .success
    ).toBe(false);
  });
});
