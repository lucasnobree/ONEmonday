"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";

interface SurveyScaleInputProps {
  /** The ordered scale values, e.g. [1..5] or [0..10]. */
  scale: readonly number[];
  value: number | undefined;
  onChange: (value: number) => void;
  /** Accessible label for the whole group. */
  label: string;
}

/**
 * An accessible numeric scale picker for survey answering. Modelled as a
 * `radiogroup` of `radio` buttons with arrow-key navigation and
 * `aria-checked`, so a 1-5 / 0-10 scale is usable with the keyboard and
 * announced correctly by screen readers (Wave 4 a11y finding).
 */
export function SurveyScaleInput({
  scale,
  value,
  onChange,
  label,
}: SurveyScaleInputProps) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      let nextIndex: number | null = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = Math.min(index + 1, scale.length - 1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = Math.max(index - 1, 0);
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = scale.length - 1;
      }
      if (nextIndex !== null) {
        event.preventDefault();
        onChange(scale[nextIndex]);
      }
    },
    [scale, onChange]
  );

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap gap-1.5"
    >
      {scale.map((option, index) => {
        const checked = value === option;
        // Keep exactly one element tabbable: the checked one, or the first.
        const tabbable = checked || (value === undefined && index === 0);
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={tabbable ? 0 : -1}
            onClick={() => onChange(option)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm font-medium transition-colors",
              checked
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input hover:bg-muted"
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
