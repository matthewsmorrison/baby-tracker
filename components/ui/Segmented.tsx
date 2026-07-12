"use client";

import { useEffect, useRef } from "react";

interface Option<T extends string> {
  value: T;
  label: string;
}

/**
 * Pill tab strip. With a few options the tabs stretch to fill the row; with
 * many they keep their natural width and the strip scrolls horizontally
 * (scrollbar hidden, active tab kept in view) instead of bursting its bounds.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the active tab visible when it changes (or was restored offscreen).
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]'
    );
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  return (
    <div
      ref={listRef}
      role="tablist"
      className={`flex overflow-x-auto rounded-full bg-surface-alt border border-line p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(o.value)}
            className={`grow shrink-0 basis-auto whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition ${
              active ? "bg-ink text-on-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
