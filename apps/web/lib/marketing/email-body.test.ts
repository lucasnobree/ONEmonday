import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  textToHtml,
  sanitizeEmailHtml,
  resolveBodyHtml,
} from "./email-body";

/**
 * Coverage for the e-mail body helpers (Wave 5 — W3).
 *
 * Before Wave 5 the body was plain text wrapped in a single `<p>` with raw
 * newline replacement — unescaped, so `<` from the operator leaked as markup.
 * The composer now derives proper escaped HTML from text and sanitises raw
 * HTML before it is persisted / previewed.
 */
describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x">b & 'c'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;b &amp; &#39;c&#39;&lt;/a&gt;"
    );
  });
});

describe("textToHtml", () => {
  it("wraps a single block in one <p>", () => {
    expect(textToHtml("Olá mundo")).toBe("<p>Olá mundo</p>");
  });

  it("turns blank-line-separated blocks into separate paragraphs", () => {
    expect(textToHtml("Linha 1\n\nLinha 2")).toBe(
      "<p>Linha 1</p>\n<p>Linha 2</p>"
    );
  });

  it("turns single newlines into <br/>", () => {
    expect(textToHtml("a\nb")).toBe("<p>a<br/>b</p>");
  });

  it("escapes HTML so plain text can never inject markup", () => {
    expect(textToHtml("<script>alert(1)</script>")).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>"
    );
  });

  it("returns an empty string for empty / whitespace input", () => {
    expect(textToHtml("")).toBe("");
    expect(textToHtml("   \n  ")).toBe("");
  });
});

describe("sanitizeEmailHtml", () => {
  it("strips <script> blocks with their content", () => {
    expect(
      sanitizeEmailHtml("<p>oi</p><script>alert(1)</script>")
    ).toBe("<p>oi</p>");
  });

  it("strips <style> blocks", () => {
    expect(
      sanitizeEmailHtml("<style>.x{color:red}</style><p>oi</p>")
    ).toBe("<p>oi</p>");
  });

  it("removes inline event handlers", () => {
    expect(
      sanitizeEmailHtml('<a href="#" onclick="steal()">x</a>')
    ).toBe('<a href="#">x</a>');
  });

  it("neutralises javascript: URLs", () => {
    expect(
      sanitizeEmailHtml(`<a href="javascript:evil()">x</a>`)
    ).toBe('<a href="#">x</a>');
  });

  it("keeps benign formatting markup intact", () => {
    const html = '<h1>Título</h1><p><strong>Olá</strong></p>';
    expect(sanitizeEmailHtml(html)).toBe(html);
  });

  it("strips an unclosed <script> tag", () => {
    expect(sanitizeEmailHtml("<p>oi</p><script>alert(1)")).not.toMatch(
      /<script/i
    );
  });

  it("strips embedding elements (iframe, object, embed, svg)", () => {
    for (const tag of ["iframe", "object", "embed", "svg"]) {
      const out = sanitizeEmailHtml(`<p>a</p><${tag}>x</${tag}><p>b</p>`);
      expect(out).not.toMatch(new RegExp(`<${tag}`, "i"));
    }
  });

  it("strips style attributes (CSS-based vectors)", () => {
    expect(
      sanitizeEmailHtml(`<p style="background:url(javascript:x)">oi</p>`)
    ).toBe("<p>oi</p>");
  });

  it("neutralises data: and vbscript: URLs", () => {
    expect(sanitizeEmailHtml(`<a href="data:text/html,<x>">x</a>`)).toContain(
      'href="#"'
    );
    expect(sanitizeEmailHtml(`<a href="vbscript:msgbox">x</a>`)).toContain(
      'href="#"'
    );
  });

  it("strips an onerror handler with no quotes", () => {
    expect(sanitizeEmailHtml("<img src=x onerror=alert(1)>")).not.toMatch(
      /onerror/i
    );
  });
});

describe("resolveBodyHtml", () => {
  it("derives HTML from text in text mode", () => {
    expect(resolveBodyHtml("text", "Olá", "<p>ignorado</p>")).toBe(
      "<p>Olá</p>"
    );
  });

  it("uses sanitised raw HTML in html mode", () => {
    expect(
      resolveBodyHtml("html", "Olá", "<p>oi</p><script>x</script>")
    ).toBe("<p>oi</p>");
  });

  it("falls back to the text-derived HTML when raw HTML is empty", () => {
    expect(resolveBodyHtml("html", "Fallback", "   ")).toBe(
      "<p>Fallback</p>"
    );
  });
});
