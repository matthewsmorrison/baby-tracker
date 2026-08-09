"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardTitle } from "@/components/ui/Card";
import { CheckCheck, EyeOff } from "lucide-react";

const OPTIONS = [
  { value: true, label: "On", icon: CheckCheck },
  { value: false, label: "Off", icon: EyeOff },
] as const;

/** Whether friends see "Seen" on messages you've read. Like WhatsApp,
 *  turning it off also hides their receipts from you. */
export function ReadReceiptsToggle({
  userId,
  initialOn,
}: {
  userId: string;
  initialOn: boolean;
}) {
  const supabase = useState(() => createClient())[0];
  const [on, setOn] = useState(initialOn);
  const [busy, setBusy] = useState(false);

  async function choose(next: boolean) {
    if (next === on || busy) return;
    setBusy(true);
    setOn(next);
    const { error } = await supabase.from("user_settings").upsert({
      user_id: userId,
      read_receipts: next,
      updated_at: new Date().toISOString(),
    });
    if (error) setOn(!next); // revert on failure
    setBusy(false);
  }

  return (
    <Card className="p-5">
      <CardTitle>Read receipts</CardTitle>
      <p className="mt-1 text-sm text-muted">
        With receipts on, friends see “Seen” once you’ve read their message.
        Turn them off and nobody gets receipts from you — and you won’t see
        theirs either.
      </p>
      <div
        role="radiogroup"
        aria-label="Read receipts"
        className="mt-3 grid grid-cols-2 gap-2"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = on === value;
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busy}
              onClick={() => choose(value)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-sm font-medium transition ${
                active
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
