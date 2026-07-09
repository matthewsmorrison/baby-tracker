"use client";

import { useState, useTransition } from "react";
import { updateTrackedTypes } from "@/lib/actions";
import type { EntryType } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { Baby, BedDouble, Check, Droplet, Milk, Moon, Scale } from "lucide-react";

const TYPES: Array<{ value: EntryType; label: string; icon: typeof Milk }> = [
  { value: "feed", label: "Feeds", icon: Milk },
  { value: "nappy", label: "Nappies", icon: Baby },
  { value: "sleep", label: "Sleep", icon: Moon },
  { value: "weight", label: "Weight", icon: Scale },
  { value: "pump", label: "Pumping", icon: Droplet },
  { value: "carer_sleep", label: "Carer sleep", icon: BedDouble },
];

export function TrackingToggles({
  babyId,
  tracked,
}: {
  babyId: string;
  tracked: EntryType[];
}) {
  const [selected, setSelected] = useState<EntryType[]>(tracked);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(t: EntryType) {
    const next = selected.includes(t)
      ? selected.filter((x) => x !== t)
      : [...selected, t];
    if (next.length === 0) {
      setError("Keep at least one category on.");
      return;
    }
    setError(null);
    setSelected(next);
    startTransition(async () => {
      try {
        await updateTrackedTypes(babyId, next);
      } catch (e) {
        setSelected(selected); // revert
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  return (
    <Card className="p-5">
      <CardTitle>What to track</CardTitle>
      <p className="mt-1 text-sm text-muted">
        Turn off anything you don’t want to log — it’ll disappear from the +
        button, Today and the charts. Existing entries are kept.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {TYPES.map(({ value, label, icon: Icon }) => {
          const on = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              disabled={pending}
              aria-pressed={on}
              onClick={() => toggle(value)}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                on
                  ? "border-ink bg-ink text-on-ink"
                  : "border-line bg-surface-alt text-muted hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{label}</span>
              {on && <Check className="h-4 w-4" />}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-alert">{error}</p>}
    </Card>
  );
}
