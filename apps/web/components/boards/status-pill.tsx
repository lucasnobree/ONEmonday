import { cn } from "@/lib/utils";
import { resolveStatusColor, statusTextColor } from "@/lib/status-colors";

/**
 * Render modes for {@link StatusPill}:
 * - `compact` — a hugging rounded pill (4px radius) used on Kanban cards and
 *   in dropdowns; the pill wraps its label.
 * - `cell` — a full-bleed colored block that fills its table cell edge-to-edge
 *   with a centered white label; the cell *is* the pill.
 */
export type StatusPillMode = "compact" | "cell";

/** Per Monday's spec a card hugs the label; a table cell fills edge-to-edge. */
export function statusPillMode(surface: "card" | "table"): StatusPillMode {
  return surface === "table" ? "cell" : "compact";
}

interface StatusPillProps {
  /** The status / column / priority label text. */
  label: string;
  /** The status swatch hex. Falsy → neutral grey "empty" swatch. */
  color?: string | null;
  /** Hugging pill (`compact`) or full-cell fill (`cell`). */
  mode?: StatusPillMode;
  className?: string;
}

/**
 * Monday's signature "Label" element. Color is the data; the label text is
 * always rendered in a contrast-correct color over the swatch.
 */
export function StatusPill({
  label,
  color,
  mode = "compact",
  className,
}: StatusPillProps) {
  const background = resolveStatusColor(color);
  const textColor = statusTextColor(background);

  return (
    <span
      data-slot="status-pill"
      data-mode={mode}
      className={cn(
        "select-none font-medium",
        mode === "compact"
          ? "inline-flex items-center rounded-[4px] px-2 py-0.5 text-xs leading-tight"
          : "flex h-full w-full items-center justify-center px-2 py-1.5 text-center text-xs",
        className
      )}
      style={{ backgroundColor: background, color: textColor }}
      title={label}
    >
      <span className={cn(mode === "cell" && "truncate")}>{label}</span>
    </span>
  );
}
