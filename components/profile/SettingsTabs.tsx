"use client";

import { useState } from "react";
import { Baby, Bell, CircleUserRound, Database, Users } from "lucide-react";

export interface SettingsSection {
  id: string;
  label: string;
  content: React.ReactNode;
}

const ICONS: Record<string, typeof Baby> = {
  baby: Baby,
  carers: Users,
  notifications: Bell,
  account: CircleUserRound,
  data: Database,
};

/**
 * Groups the settings into switchable sections so it's not one long scroll.
 * A compact icon bar (like the bottom nav) shows every section at once — no
 * horizontal scrolling — and only the selected section renders.
 */
export function SettingsTabs({ sections }: { sections: SettingsSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const current = sections.find((s) => s.id === active) ?? sections[0];

  return (
    <div className="animate-rise">
      <div
        role="tablist"
        aria-label="Settings sections"
        className="sticky top-0 z-10 -mx-4 mb-4 flex gap-1 border-b border-line bg-bg/90 px-2 py-1.5 backdrop-blur md:static md:mx-0 md:rounded-2xl md:border md:bg-surface md:px-1.5"
      >
        {sections.map((s) => {
          const Icon = ICONS[s.id] ?? Baby;
          const on = s.id === current?.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(s.id)}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-medium transition ${
                on
                  ? "bg-surface-alt text-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={on ? 2.3 : 2} />
              <span className="truncate">{s.label}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">{current?.content}</div>
    </div>
  );
}
