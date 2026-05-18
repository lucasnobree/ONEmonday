import { describe, it, expect } from "vitest";
import { parseMarkdown, parseInline, stripMarkdown, isSafeHref } from "./markdown";

describe("stripMarkdown", () => {
  it("removes heading markers", () => {
    expect(stripMarkdown("## Resetar Senha")).toBe("Resetar Senha");
  });

  it("removes bold and italic markers", () => {
    expect(stripMarkdown("Acesse **Configuracoes** e _Perfil_")).toBe(
      "Acesse Configuracoes e Perfil"
    );
  });

  it("removes ordered and unordered list markers", () => {
    expect(stripMarkdown("1. Primeiro\n- Segundo")).toBe("Primeiro Segundo");
  });

  it("keeps link labels and drops the url", () => {
    expect(stripMarkdown("Veja [a doc](https://ex.com/x)")).toBe(
      "Veja a doc"
    );
  });

  it("strips inline code backticks", () => {
    expect(stripMarkdown("Rode `npm test` agora")).toBe("Rode npm test agora");
  });
});

describe("parseInline", () => {
  it("parses bold spans", () => {
    const nodes = parseInline("texto **forte** aqui");
    expect(nodes).toEqual([
      { type: "text", value: "texto " },
      { type: "bold", value: "forte" },
      { type: "text", value: " aqui" },
    ]);
  });

  it("parses inline code and links", () => {
    const nodes = parseInline("`code` e [link](https://x.com)");
    expect(nodes[0]).toEqual({ type: "code", value: "code" });
    expect(nodes[2]).toEqual({
      type: "link",
      value: "link",
      href: "https://x.com",
    });
  });

  it("returns a single text node for plain input", () => {
    expect(parseInline("sem formatação")).toEqual([
      { type: "text", value: "sem formatação" },
    ]);
  });

  it("drops a javascript: link to plain text (stored XSS guard)", () => {
    const nodes = parseInline("[clique](javascript:alert)");
    expect(nodes).toEqual([{ type: "text", value: "clique" }]);
  });

  it("drops a data: link to plain text", () => {
    const nodes = parseInline("[x](data:text/html;base64,abc)");
    expect(nodes).toEqual([{ type: "text", value: "x" }]);
  });

  it("keeps a root-relative link", () => {
    const nodes = parseInline("[kb](/support/knowledge-base)");
    expect(nodes[0]).toEqual({
      type: "link",
      value: "kb",
      href: "/support/knowledge-base",
    });
  });

  it("keeps a mailto: link", () => {
    const nodes = parseInline("[mail](mailto:a@b.com)");
    expect(nodes[0]).toMatchObject({ type: "link", href: "mailto:a@b.com" });
  });
});

describe("isSafeHref", () => {
  it("accepts http, https, mailto and root-relative URLs", () => {
    expect(isSafeHref("https://x.com")).toBe(true);
    expect(isSafeHref("http://x.com")).toBe(true);
    expect(isSafeHref("mailto:a@b.com")).toBe(true);
    expect(isSafeHref("/internal/path")).toBe(true);
  });

  it("rejects javascript:, data: and other schemes", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,abc")).toBe(false);
    expect(isSafeHref("vbscript:msgbox")).toBe(false);
    expect(isSafeHref("  javascript:alert(1)")).toBe(false);
  });
});

describe("parseMarkdown", () => {
  it("parses headings with their level", () => {
    const blocks = parseMarkdown("# Um\n## Dois\n### Tres");
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ type: "heading", level: 1 });
    expect(blocks[1]).toMatchObject({ type: "heading", level: 2 });
    expect(blocks[2]).toMatchObject({ type: "heading", level: 3 });
  });

  it("groups consecutive list items into one list block", () => {
    const blocks = parseMarkdown("- a\n- b\n- c");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("list");
    if (blocks[0].type === "list") {
      expect(blocks[0].ordered).toBe(false);
      expect(blocks[0].items).toHaveLength(3);
    }
  });

  it("detects ordered lists", () => {
    const blocks = parseMarkdown("1. um\n2. dois");
    expect(blocks[0].type).toBe("list");
    if (blocks[0].type === "list") {
      expect(blocks[0].ordered).toBe(true);
    }
  });

  it("joins wrapped lines into a single paragraph", () => {
    const blocks = parseMarkdown("linha um\nlinha dois\n\noutro paragrafo");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: "paragraph" });
    if (blocks[0].type === "paragraph") {
      expect(blocks[0].inline[0]).toEqual({
        type: "text",
        value: "linha um linha dois",
      });
    }
  });

  it("ignores blank lines", () => {
    expect(parseMarkdown("\n\n  \n")).toEqual([]);
  });
});
