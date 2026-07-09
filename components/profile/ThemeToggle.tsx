"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Monitor, Moon, Sun } from "lucide-react";
import { applyTheme, getThemePref, THEME_KEY, type ThemePref } from "@/lib/theme";

const OPTIONS: Array<{ value: ThemePref; label: string; icon: typeof Sun }> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>("system");

  // Read the saved preference after mount (localStorage is client-only; a
  // deferred set avoids a hydration mismatch with the server's "system").
  useEffect(() => {
    const id = window.setTimeout(() => setPref(getThemePref()), 0);
    return () => window.clearTimeout(id);
  }, []);

  // While on System, follow live OS changes so the status bar keeps up.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      if (getThemePref() === "system") applyTheme("system");
    };
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  function choose(next: ThemePref) {
    setPref(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* private mode etc. — still applies for this session */
    }
    applyTheme(next);
  }

  return (
    <Card className="p-5">
      <CardTitle>Appearance</CardTitle>
      <p className="mt-1 text-sm text-muted">
        Dark mode is gentler for middle-of-the-night feeds. Match your device
        or choose one — it’s saved on this device.
      </p>
      <div
        role="radiogroup"
        aria-label="Theme"
        className="mt-3 grid grid-cols-3 gap-2"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const on = pref === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(value)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-sm font-medium transition ${
                on
                  ? "border-ink bg-ink text-on-ink"
                  : "border-line bg-surface-alt text-muted hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
