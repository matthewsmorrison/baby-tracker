"use client";

import { useEffect, useMemo, useState } from "react";
import { formatGap } from "@/lib/entryDisplay";
import { predictNextFeed } from "@/lib/predict";
import { Card, CardTitle } from "@/components/ui/Card";
import { Clock, Sparkles } from "lucide-react";

/**
 * Two separate feed cards, client-rendered so the times show in the viewer's
 * own timezone against their real clock:
 *   · "Next feed due" — from the parent-configured interval (when set)
 *   · "Bea's guess" — from the baby's own rhythm (lib/predict), self-graded
 * Either renders alone when the other has nothing to say.
 */
export function NextFeedCard({
  feedStartsISO,
  intervalMin,
}: {
  /** All feed start times (any order). */
  feedStartsISO: string[];
  /** Parent-configured expected gap; null → prediction card only. */
  intervalMin?: number | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const startsMs = useMemo(
    () => feedStartsISO.map((iso) => new Date(iso).getTime()),
    [feedStartsISO]
  );
  const prediction = useMemo(() => predictNextFeed(startsMs), [startsMs]);
  const lastFeedMs = startsMs.length ? Math.max(...startsMs) : null;
  if (lastFeedMs === null) return null;

  const time = (ms: number) =>
    new Date(ms).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  const countdown = (dueMs: number) => {
    const overdueMs = now - dueMs;
    return {
      late: overdueMs > 0,
      label:
        overdueMs > 0
          ? `${formatGap(overdueMs)} past`
          : `in ${formatGap(-overdueMs)}`,
    };
  };

  const intervalDue = intervalMin ? lastFeedMs + intervalMin * 60_000 : null;
  const acc = prediction?.accuracy
    ? ` (${prediction.accuracy.hits}/${prediction.accuracy.n} on target)`
    : "";

  return (
    <>
      {intervalDue && (
        <Card className="flex items-center gap-4 p-5">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              countdown(intervalDue).late ? "bg-accent-soft" : "bg-positive-bg"
            }`}
          >
            <Clock
              className={`h-5 w-5 ${
                countdown(intervalDue).late ? "text-watch" : "text-positive"
              }`}
            />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle>Next feed due</CardTitle>
            <p className="stat-num text-2xl leading-tight">
              ~{time(intervalDue)}
              <span
                className={`ml-2 text-sm font-medium ${
                  countdown(intervalDue).late ? "text-watch" : "text-muted"
                }`}
              >
                {countdown(intervalDue).label}
              </span>
            </p>
            <p className="text-xs text-muted">
              Your {formatGap(intervalMin! * 60_000)} interval · feed on cues
            </p>
          </div>
        </Card>
      )}

      {prediction && (
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft">
            <Sparkles className="h-5 w-5 text-accent" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle>Bea’s guess — next feed</CardTitle>
            <p className="stat-num text-2xl leading-tight">
              ~{time(prediction.nextAtMs)}
              <span
                className={`ml-2 text-sm font-medium ${
                  countdown(prediction.nextAtMs).late
                    ? "text-watch"
                    : "text-muted"
                }`}
              >
                {countdown(prediction.nextAtMs).label}
              </span>
            </p>
            <p className="text-xs text-muted">
              Their rhythm — feeds ~{formatGap(prediction.typicalGapMs)} apart
              {acc}
            </p>
          </div>
        </Card>
      )}
    </>
  );
}
