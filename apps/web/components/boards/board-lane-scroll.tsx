"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface BoardLaneScrollProps {
  children: React.ReactNode;
}

/**
 * Horizontal scroll container for a Kanban swimlane.
 *
 * Adds a left/right edge gradient that appears only when there is more content
 * to scroll towards, so a user can tell columns continue past the viewport
 * edge (the Wave 4 audit flagged the rightmost column being clipped with no
 * affordance). Edge state is recomputed on scroll and on resize.
 */
export function BoardLaneScroll({ children }: BoardLaneScrollProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    for (const child of Array.from(el.children)) {
      observer.observe(child);
    }

    return () => observer.disconnect();
  }, [updateEdges]);

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={updateEdges}
        className="flex gap-4 overflow-x-auto pb-4"
      >
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent transition-opacity",
          canScrollLeft ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent transition-opacity",
          canScrollRight ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}
