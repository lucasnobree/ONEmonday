/**
 * E-mail body helpers — Wave 5 (W3: a real HTML e-mail body).
 *
 * Before Wave 5 a campaign body was plain text wrapped in a single `<p>`. The
 * composer now offers two modes:
 *  - "text": the operator writes plain text; HTML is derived automatically by
 *    {@link textToHtml} (paragraphs + line breaks, properly escaped).
 *  - "html": the operator writes raw HTML directly (a lightweight editor — no
 *    heavy WYSIWYG dependency).
 *
 * {@link sanitizeEmailHtml} strips script/style/event-handler vectors so a
 * pasted snippet cannot smuggle active content into the rendered body. It is
 * intentionally conservative — e-mail clients ignore scripts anyway, but the
 * in-app preview renders the HTML, so the same string must be safe there.
 */

/** Escapes the five HTML-significant characters in plain text. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Converts a plain-text body into simple, safe HTML: blank-line-separated
 * blocks become `<p>` elements; single newlines become `<br/>`. The input is
 * fully escaped first, so it can never inject markup.
 */
export function textToHtml(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "";

  return trimmed
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

/**
 * Conservatively sanitises a raw HTML e-mail body. Removes `<script>` and
 * `<style>` blocks, inline `on*` event handlers, and `javascript:` URLs. It is
 * a string-level pass (no DOM dependency) so it runs identically on the server
 * and client.
 */
export function sanitizeEmailHtml(html: string): string {
  return html
    // Drop whole <script>/<style> elements including their content.
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    // Drop any standalone closing tags left behind.
    .replace(/<\/?(?:script|style)\b[^>]*>/gi, "")
    // Strip inline event handlers: on...="..." / on...='...' / on...=value.
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    // Neutralise javascript: URLs in href/src attributes.
    .replace(/(href|src)\s*=\s*"javascript:[^"]*"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'javascript:[^']*'/gi, "$1='#'");
}

/**
 * Resolves the HTML body to persist, given the composer mode and both fields.
 * In "text" mode the HTML is derived from the text; in "html" mode the raw
 * HTML is sanitised. Falls back to the derived text HTML when raw HTML is
 * empty, so `body_html` is never an empty string for a non-empty campaign.
 */
export function resolveBodyHtml(
  mode: "text" | "html",
  bodyText: string,
  bodyHtml: string
): string {
  if (mode === "html" && bodyHtml.trim().length > 0) {
    return sanitizeEmailHtml(bodyHtml);
  }
  return textToHtml(bodyText);
}
