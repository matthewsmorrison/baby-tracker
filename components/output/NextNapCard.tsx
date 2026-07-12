"use client";

import { useEffect, useMemo, useState } from "react";
import { formatGap } from "@/lib/entryDisplay";
import { predictNextNap, type SleepSpan } from "@/lib/predict";
import { Card, CardTitle } from "@/components/ui/Card";
import { Moon } from "lucide-react";

/**
 * The nap "sweet spot": when to start settling the baby, predicted from the
 * awake stretches between logged sleeps (lib/predict). Client-rendered so
 * the times show in the viewer's timezone against their real clock.
 *
 * States: a teaser until the first sleep is logged (so the feature is
 * discoverable), hidden while the baby is logged as asleep, the live window
 * while it's relevant, and hidden again once it's long past.
 */
export function NextNapCard({
  sleeps,
  birthAt,
}: {
  /** All baby-sleep entries: start ISO + end ISO (null while ongoing). */
  sleeps: Array<{ start: string; end: string | null }>;
  birthAt: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const spans = useMemo<SleepSpan[]>(
    () =>
      sleeps.map((s) => ({
        startMs: new Date(s.start).getTime(),
        endMs: s.end ? new Date(s.end).getTime() : null,
      })),
    [sleeps]
  );
  const birthAtMs = useMemo(() => new Date(birthAt).getTime(), [birthAt]);
  const p = useMemo(
    () => predictNextNap(spans, birthAtMs, now),
    [spans, birthAtMs, now]
  );

  const asleep = spans.some(
    (s) =>
      s.endMs === null && s.startMs <= now && now - s.startMs < 12 * 3600_000
  );
  if (asleep) return null;

  // No finished sleeps yet — tease the feature instead of hiding it.
  if (!spans.some((s) => s.endMs !== null)) {
    return (
      <Card className="flex items-center gap-4 p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-alt">
          <Moon className="h-5 w-5 text-muted" />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle>Nap window</CardTitle>
          <p className="mt-0.5 text-sm text-muted">
            Log a sleep or two and Bea will predict the best moment to put
            them down for the next one.
          </p>
        </div>
      </Card>
    );
  }

  if (!p) return null;
  // Long past the window (the nap probably happened unlogged) — a stale
  // prediction is worse than none.
  if (now > p.windowEndMs + p.typicalWakeMs) return null;

  const time = (ms: number) =>
    new Date(ms).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });

  const before = now < p.windowStartMs;
  const inWindow = now >= p.windowStartMs && now <= p.windowEndMs;
  const status = before
    ? `in ${formatGap(p.windowStartMs - now)}`
    : inWindow
      ? "open now"
      : "just passed — watch for tired cues";

  const basis =
    p.basis === "observed"
      ? `Their rhythm — ~${formatGap(p.typicalWakeMs)} awake`
      : `Typical for this age — ~${formatGap(p.typicalWakeMs)} awake`;
  const acc = p.accuracy ? ` (${p.accuracy.hits}/${p.accuracy.n} on target)` : "";

  return (
    <Card className="flex items-center gap-4 p-5">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          inWindow ? "bg-accent-soft" : "bg-surface-alt"
        }`}
      >
        <Moon className={`h-5 w-5 ${inWindow ? "text-accent" : "text-muted"}`} />
      </span>
      <div className="min-w-0 flex-1">
        <CardTitle>Nap window</CardTitle>
        <p className="stat-num text-2xl leading-tight">
          {time(p.windowStartMs)}–{time(p.windowEndMs)}
          <span
            className={`ml-2 text-sm font-medium ${
              inWindow ? "text-accent" : "text-muted"
            }`}
          >
            {status}
          </span>
        </p>
        <p className="text-xs text-muted">
          {basis}
          {acc} · awake since {time(p.lastWokeMs)} · tired cues win
        </p>
      </div>
    </Card>
  );
}
