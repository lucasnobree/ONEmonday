import { describe, it, expect } from "vitest";
import { parseOfx, parseOfxDate, parseOfxAmount } from "./ofx";

describe("parseOfxDate", () => {
  it("parses a bare date", () => {
    expect(parseOfxDate("20260510")).toBe("2026-05-10");
  });

  it("parses a datetime with a timezone suffix", () => {
    expect(parseOfxDate("20260510120000[-3:BRT]")).toBe("2026-05-10");
  });

  it("returns null for unparseable input", () => {
    expect(parseOfxDate("nope")).toBeNull();
    expect(parseOfxDate(null)).toBeNull();
  });
});

describe("parseOfxAmount", () => {
  it("parses a positive amount as a credit", () => {
    expect(parseOfxAmount("1500.00")).toEqual({
      amountCents: 150_000,
      direction: "credit",
    });
  });

  it("parses a negative amount as a debit", () => {
    expect(parseOfxAmount("-89.90")).toEqual({
      amountCents: 8_990,
      direction: "debit",
    });
  });

  it("accepts a comma decimal separator", () => {
    expect(parseOfxAmount("-12,34")?.amountCents).toBe(1_234);
  });

  // Regression — Finance S3: pt-BR banks export grouped amounts where "." is
  // the thousands separator. A naive ","->"." replace turned "1.500,00" into
  // the broken "1.500.00" -> NaN. parseCents (money.ts) handles it correctly.
  it("parses a pt-BR grouped amount (dot thousands, comma decimal)", () => {
    expect(parseOfxAmount("1.500,00")).toEqual({
      amountCents: 150_000,
      direction: "credit",
    });
  });

  it("parses a negative pt-BR grouped amount as a debit", () => {
    expect(parseOfxAmount("-2.345,67")).toEqual({
      amountCents: 234_567,
      direction: "debit",
    });
  });

  it("parses a millions-scale pt-BR grouped amount", () => {
    expect(parseOfxAmount("1.234.567,89")?.amountCents).toBe(123_456_789);
  });

  it("still parses an en-US grouped amount (comma thousands)", () => {
    expect(parseOfxAmount("-1,500.00")?.amountCents).toBe(150_000);
  });

  it("treats a leading + sign as a credit", () => {
    expect(parseOfxAmount("+99.90")).toEqual({
      amountCents: 9_990,
      direction: "credit",
    });
  });

  it("returns null for zero or unparseable input", () => {
    expect(parseOfxAmount("0.00")).toBeNull();
    expect(parseOfxAmount("abc")).toBeNull();
    expect(parseOfxAmount(null)).toBeNull();
    expect(parseOfxAmount("")).toBeNull();
  });
});

describe("parseOfx", () => {
  const ofx = `
OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260502120000[-3:BRT]
<TRNAMT>2500.00
<FITID>TX-001
<MEMO>Recebimento cliente A
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260503
<TRNAMT>-340.50
<FITID>TX-002
<NAME>Fornecedor X
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>
`;

  it("parses every STMTTRN block into a transaction", () => {
    const txs = parseOfx(ofx);
    expect(txs).toHaveLength(2);
    expect(txs[0]).toEqual({
      externalId: "TX-001",
      direction: "credit",
      amountCents: 250_000,
      currency: "BRL",
      postedDate: "2026-05-02",
      description: "Recebimento cliente A",
    });
    expect(txs[1].direction).toBe("debit");
    expect(txs[1].amountCents).toBe(34_050);
    expect(txs[1].description).toBe("Fornecedor X");
  });

  it("skips a block missing a FITID, amount or date", () => {
    const broken = `
<STMTTRN><TRNAMT>10.00<DTPOSTED>20260101</STMTTRN>
<STMTTRN><FITID>OK<TRNAMT>10.00<DTPOSTED>20260101</STMTTRN>
`;
    expect(parseOfx(broken)).toHaveLength(1);
  });

  it("returns an empty array for empty input", () => {
    expect(parseOfx("")).toEqual([]);
  });
});
