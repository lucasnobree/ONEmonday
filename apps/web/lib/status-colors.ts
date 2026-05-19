/**
 * Monday-style status palette helpers. "Color is data": every status / group /
 * priority label resolves to one swatch from this canonical set, mirroring the
 * Vibe design system. Pure module — safe to unit-test and import on the server.
 */

import type { Priority } from "@/lib/constants";

/** A status label gets one of these canonical Monday colors. */
export const STATUS_PALETTE = {
  green: "#00C875",
  orange: "#FDAB3D",
  red: "#E2445C",
  grey: "#C4C4C4",
  blue: "#579BFC",
  purple: "#A25DDC",
  darkGreen: "#037F4C",
  yellow: "#FFCB00",
} as const;

export type StatusColorName = keyof typeof STATUS_PALETTE;

/** Neutral fallback for an empty / not-started status. */
export const EMPTY_STATUS_COLOR = STATUS_PALETTE.grey;

/** Maps a card priority to a Monday palette swatch. */
export const PRIORITY_STATUS_COLOR: Record<Priority, string> = {
  critical: STATUS_PALETTE.red,
  high: STATUS_PALETTE.orange,
  medium: STATUS_PALETTE.yellow,
  low: STATUS_PALETTE.green,
};

/**
 * Resolves the color to render for a status pill. An explicit `color` (e.g. a
 * board column's color) wins; otherwise we fall back to the neutral empty
 * swatch so "no status" still reads as a deliberate grey, never a missing box.
 */
export function resolveStatusColor(color: string | null | undefined): string {
  const trimmed = color?.trim();
  return trimmed ? trimmed : EMPTY_STATUS_COLOR;
}

/**
 * Picks a readable text color (black or white) for a given background hex,
 * using the WCAG relative-luminance threshold. Light swatches (e.g. the
 * yellow `#FFCB00`) get dark text; everything else gets white.
 */
export function statusTextColor(backgroundHex: string): "#FFFFFF" | "#323338" {
  const hex = backgroundHex.replace("#", "");
  if (hex.length !== 3 && hex.length !== 6) return "#FFFFFF";

  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const channel = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const luminance =
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

  // Threshold ~0.6: bright/yellow swatches read better with dark text.
  return luminance > 0.6 ? "#323338" : "#FFFFFF";
}
