"use client";

import { useEffect, useState } from "react";
import { formatGap } from "@/lib/entryDisplay";
import { Card, CardTitle } from "@/components/ui/Card";
import { Clock } from "lucide-react";

/**
 * "Next feed due" — rendered on the client so the due time shows in the
 * viewer's own timezone and the countdown is measured against their real
 * clock (the page is server-rendered in UTC, which mislabels both).
 */
export function NextFeedCard({
  lastFeedStartISO,
  intervalMin,
  typicalGapMs,
}: {
  lastFeedStartISO: string;
  intervalMin: number;
  typicalGapMs?: number | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const due = new Date(lastFeedStartISO).getTime() + intervalMin * 60_000;
  const overdueMs = now - due;
  const late = overdueMs > 0;

  return (
    <Card className="flex items-center gap-4 p-5">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          late ? "bg-accent-soft" : "bg-positive-bg"
        }`}
      >
        <Clock className={`h-5 w-5 ${late ? "text-[#A45A1B]" : "text-positive"}`} />
      </span>
      <div className="min-w-0 flex-1">
        <CardTitle>Next feed due</CardTitle>
        <p className="stat-num text-2xl leading-tight">
          ~
          {new Date(due).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
          <span
            className={`ml-2 text-sm font-medium ${
              late ? "text-[#A45A1B]" : "text-muted"
            }`}
          >
            {late ? `about now — ${formatGap(overdueMs)} past` : `in ${formatGap(-overdueMs)}`}
          </span>
        </p>
        <p className="text-xs text-muted">
          Based on your {formatGap(intervalMin * 60_000)} interval
          {typicalGapMs
            ? ` — feeds have actually been ~${formatGap(typicalGapMs)} apart lately`
            : ""}
          . A guide, not a schedule — feed on cues.
        </p>
      </div>
    </Card>
  );
}
