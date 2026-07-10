"use client";

import { useState } from "react";

export interface SettingsSection {
  id: string;
  label: string;
  content: React.ReactNode;
}

/**
 * Groups the settings into switchable sections so it's not one long scroll.
 * A scrollable pill row picks the category; only that section renders.
 */
export function SettingsTabs({ sections }: { sections: SettingsSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const current = sections.find((s) => s.id === active) ?? sections[0];

  return (
    <div className="animate-rise">
      <div className="sticky top-0 z-10 -mx-4 mb-4 bg-bg/90 px-4 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div
          role="tablist"
          aria-label="Settings sections"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {sections.map((s) => {
            const on = s.id === current?.id;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActive(s.id)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  on
                    ? "border-ink bg-ink text-on-ink"
                    : "border-line bg-surface text-muted hover:text-ink"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">{current?.content}</div>
    </div>
  );
}
