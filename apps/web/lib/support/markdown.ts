// Minimal, dependency-free Markdown support for the Support Desk knowledge
// base. A full Markdown library (react-markdown / remark) would be the proper
// choice, but adding a dependency is out of this module's scope, so this
// covers the subset KB articles actually use: headings, bold, italic, inline
// code, links, and ordered/unordered lists.
//
// Pure module (no React) so it can be unit tested. The renderer in
// `markdown-renderer.tsx` consumes the block model produced here.

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; value: string; href: string };

export type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; inline: InlineNode[] }
  | { type: "paragraph"; inline: InlineNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] };

/**
 * Strip Markdown syntax to a plain-text string. Used for card previews where
 * raw `##` / `**` markers would otherwise leak into the UI.
 */
export function stripMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/^#{1,6}\s+/gm, "") // heading markers
    .replace(/^\s*[-*+]\s+/gm, "") // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, "") // ordered list markers
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> label
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/^\s*>\s?/gm, "") // blockquote markers
    .replace(/\s+/g, " ")
    .trim();
}

// Order matters: longer / more specific markers first.
const INLINE_PATTERN =
  /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*|_[^_]+_)/;

/**
 * Only allow link hrefs we are confident cannot execute script. KB articles
 * are user-authored and rendered to other agents, so `javascript:` / `data:`
 * URLs must never reach an anchor's href (stored XSS). Anything else degrades
 * to plain text.
 */
export function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed.startsWith("/")) return true; // root-relative
  return /^(https?:|mailto:)/i.test(trimmed);
}

/** Parse a single line of inline Markdown into styled nodes. */
export function parseInline(line: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let rest = line;

  while (rest.length > 0) {
    const match = rest.match(INLINE_PATTERN);
    if (!match || match.index === undefined) {
      nodes.push({ type: "text", value: rest });
      break;
    }
    if (match.index > 0) {
      nodes.push({ type: "text", value: rest.slice(0, match.index) });
    }
    const token = match[0];
    if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push({ type: "bold", value: token.slice(2, -2) });
    } else if (token.startsWith("`")) {
      nodes.push({ type: "code", value: token.slice(1, -1) });
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch && isSafeHref(linkMatch[2])) {
        nodes.push({
          type: "link",
          value: linkMatch[1],
          href: linkMatch[2].trim(),
        });
      } else if (linkMatch) {
        // Unsafe scheme (javascript:, data:, …) — keep the label, drop the link.
        nodes.push({ type: "text", value: linkMatch[1] });
      } else {
        nodes.push({ type: "text", value: token });
      }
    } else {
      // single * or _
      nodes.push({ type: "italic", value: token.slice(1, -1) });
    }
    rest = rest.slice(match.index + token.length);
  }

  return nodes.length ? nodes : [{ type: "text", value: "" }];
}

/** Parse a Markdown document into a flat list of block nodes. */
export function parseMarkdown(input: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = input.replace(/\r\n/g, "\n").split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      i += 1;
      continue;
    }

    // Heading
    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        inline: parseInline(heading[2]),
      });
      i += 1;
      continue;
    }

    // List (consume consecutive list items of the same kind)
    const isUnordered = /^[-*+]\s+/.test(trimmed);
    const isOrdered = /^\d+\.\s+/.test(trimmed);
    if (isUnordered || isOrdered) {
      const ordered = isOrdered;
      const items: InlineNode[][] = [];
      while (i < lines.length) {
        const itemLine = lines[i].trim();
        const itemMatch = ordered
          ? itemLine.match(/^\d+\.\s+(.*)$/)
          : itemLine.match(/^[-*+]\s+(.*)$/);
        if (!itemMatch) break;
        items.push(parseInline(itemMatch[1]));
        i += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // Paragraph (consume consecutive non-blank, non-block lines)
    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const pLine = lines[i].trim();
      if (
        pLine === "" ||
        /^(#{1,3})\s+/.test(pLine) ||
        /^[-*+]\s+/.test(pLine) ||
        /^\d+\.\s+/.test(pLine)
      ) {
        break;
      }
      paragraphLines.push(pLine);
      i += 1;
    }
    blocks.push({
      type: "paragraph",
      inline: parseInline(paragraphLines.join(" ")),
    });
  }

  return blocks;
}
