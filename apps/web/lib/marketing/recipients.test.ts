import { describe, it, expect } from "vitest";
import { parseRecipients, isValidEmail } from "./recipients";

/**
 * Coverage for the e-mail recipient parser (Wave 5 — W2/W4).
 *
 * Before Wave 5 the send dialog accepted ANY non-empty token as a recipient
 * (`"joao(at)exemplo"` became a "recipient" and inflated the count). The parser
 * now validates each line and reports valid / invalid / duplicate counts.
 */
describe("isValidEmail", () => {
  it("accepts a well-formed address", () => {
    expect(isValidEmail("joao@exemplo.com")).toBe(true);
  });

  it("rejects an address with no @, no domain, or spaces", () => {
    expect(isValidEmail("joao(at)exemplo")).toBe(false);
    expect(isValidEmail("joao@exemplo")).toBe(false);
    expect(isValidEmail("joao @exemplo.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("parseRecipients", () => {
  it("parses plain and `Name <email>` lines", () => {
    const result = parseRecipients(
      "joao@exemplo.com\nMaria <maria@exemplo.com>"
    );
    expect(result.valid).toEqual([
      { email: "joao@exemplo.com" },
      { email: "maria@exemplo.com", name: "Maria" },
    ]);
    expect(result.invalid).toEqual([]);
  });

  it("splits on newlines, commas and semicolons", () => {
    const result = parseRecipients("a@x.com, b@x.com; c@x.com");
    expect(result.valid).toHaveLength(3);
  });

  it("collects malformed lines as invalid instead of accepting them", () => {
    const result = parseRecipients("good@x.com\njoao(at)exemplo\nbad@");
    expect(result.valid).toEqual([{ email: "good@x.com" }]);
    expect(result.invalid).toEqual(["joao(at)exemplo", "bad@"]);
  });

  it("de-duplicates case-insensitively and counts the drops", () => {
    const result = parseRecipients("A@x.com\na@x.com\nb@x.com");
    expect(result.valid).toEqual([{ email: "A@x.com" }, { email: "b@x.com" }]);
    expect(result.duplicates).toBe(1);
  });

  it("ignores blank lines and surrounding whitespace", () => {
    const result = parseRecipients("\n  joao@exemplo.com  \n\n");
    expect(result.valid).toEqual([{ email: "joao@exemplo.com" }]);
  });

  it("returns empty results for an empty block", () => {
    expect(parseRecipients("")).toEqual({
      valid: [],
      invalid: [],
      duplicates: 0,
    });
  });
});
