"use client";

import { useState, useSyncExternalStore } from "react";
import { toggleDayTag } from "@/lib/actions";
import type { DayTag, DayTagKind } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/Card";
import { dayKey } from "@/components/output/entryList";

export const DAY_TAG_LABELS: Record<DayTagKind, string> = {
  no_poo: "No poo",
  teething: "Teething",
};

const subscribeNoop = () => () => {};

/**
 * Whole-day tags for today — a one-tap alternative to point-in-time logging
 * ("no poo today", "teething day") that the History calendar can show back
 * for pattern-spotting. "Today" resolves client-side: the server can't know
 * the viewer's timezone, and a wrong guess near midnight would tag the wrong
 * day (null during SSR, so the chips render disabled until hydration).
 */
export function DayTagCard({
  babyId,
  recentTags,
}: {
  babyId: string;
  /** Tags around today (server pre-fetch); the card picks the local date's. */
  recentTags: DayTag[];
}) {
  const today = useSyncExternalStore(
    subscribeNoop,
    () => dayKey(new Date()),
    () => null
  );
  // Optimistic flips layered over the server-provided state; an entry only
  // exists for tags the user has toggled this visit.
  const [overrides, setOverrides] = useState<Partial<Record<DayTagKind, boolean>>>({});
  const [busy, setBusy] = useState<DayTagKind | null>(null);

  const isActive = (tag: DayTagKind) =>
    overrides[tag] ??
    recentTags.some((t) => t.day === today && t.tag === tag);

  async function toggle(tag: DayTagKind) {
    if (!today || busy) return;
    setBusy(tag);
    const next = !isActive(tag);
    setOverrides((prev) => ({ ...prev, [tag]: next }));
    const res = await toggleDayTag(babyId, today, tag);
    if (res.error) {
      setOverrides((prev) => ({ ...prev, [tag]: !next }));
    }
    setBusy(null);
  }

  return (
    <Card className="p-5">
      <CardTitle>Mark the day</CardTitle>
      <p className="mt-1 text-sm text-muted">
        Whole-day notes — no time needed. They show on the History calendar so
        you can look back for patterns.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(DAY_TAG_LABELS) as DayTagKind[]).map((tag) => {
          const active = today ? isActive(tag) : false;
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={active}
              disabled={!today || busy === tag}
              onClick={() => toggle(tag)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                active
                  ? "border-ink bg-ink text-on-ink"
                  : "border-line bg-surface-alt text-muted hover:text-ink"
              }`}
            >
              {DAY_TAG_LABELS[tag]}
            </button>
          );
        })}
      </div>
      {today && isActive("no_poo") && (
        <p className="mt-3 text-xs text-muted">
          Past the first weeks, breastfed babies can happily go several days
          between poos. Hard, pellet-like stools or real discomfort are worth
          mentioning to your health visitor.
        </p>
      )}
    </Card>
  );
}
