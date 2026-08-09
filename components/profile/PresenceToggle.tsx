"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { APPEAR_OFFLINE_EVENT, APPEAR_OFFLINE_KEY } from "@/lib/presence";
import { Card, CardTitle } from "@/components/ui/Card";
import { Eye, EyeOff } from "lucide-react";

const OPTIONS = [
  { value: false, label: "Visible", icon: Eye },
  { value: true, label: "Appear offline", icon: EyeOff },
] as const;

/** Account-level presence privacy: hide the green dot from friends even
 *  while the app is open. Stored in user_settings (private to you). */
export function PresenceToggle({
  userId,
  initialAppearOffline,
}: {
  userId: string;
  initialAppearOffline: boolean;
}) {
  const supabase = useState(() => createClient())[0];
  const [hidden, setHidden] = useState(initialAppearOffline);
  const [busy, setBusy] = useState(false);

  async function choose(next: boolean) {
    if (next === hidden || busy) return;
    setBusy(true);
    setHidden(next);
    try {
      const { error } = await supabase.from("user_settings").upsert({
        user_id: userId,
        appear_offline: next,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      // Mirror locally so the publisher in this and other tabs reacts now.
      localStorage.setItem(APPEAR_OFFLINE_KEY, next ? "1" : "0");
      window.dispatchEvent(new Event(APPEAR_OFFLINE_EVENT));
      if (next) {
        // Go grey immediately rather than waiting for the heartbeat TTL.
        await supabase
          .from("profiles")
          .update({
            presence_status: "offline",
            presence_at: new Date().toISOString(),
          })
          .eq("id", userId);
      }
    } catch {
      setHidden(!next); // revert on failure
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <CardTitle>Presence</CardTitle>
      <p className="mt-1 text-sm text-muted">
        Friends normally see a green dot while you have beanlo open (and a
        pulse during a feed). Appear offline hides it — you can still see
        theirs and message as usual.
      </p>
      <div
        role="radiogroup"
        aria-label="Presence"
        className="mt-3 grid grid-cols-2 gap-2"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const on = hidden === value;
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={busy}
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
