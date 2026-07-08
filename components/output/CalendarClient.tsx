"use client";
import { useMemo, useState } from "react";
import { DISCLAIMER, dayOfLife } from "@/lib/clinical";
import type { Entry } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import {
  DayTotals,
  EntryRow,
  PhotoLightbox,
  dayKey,
} from "./entryList";
import { Baby, ChevronLeft, ChevronRight, Milk, Scale } from "lucide-react";

export function CalendarGrid({
  entries,
  birthAt,
  birthWeightG,
  photoUrls,
  canEdit,
  onPhotoClick,
  nappyBaseWeightG,
}: {
  entries: Entry[];
  birthAt: string;
  birthWeightG: number;
  photoUrls: Record<string, string>;
  canEdit: boolean;
  onPhotoClick: (url: string) => void;
  nappyBaseWeightG?: number | null;
}) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(() =>
    dayKey(new Date())
  );

  const byDay = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of entries) {
      const k = dayKey(new Date(e.occurred_at));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    // entries arrive newest-first; show each day oldest-first
    for (const list of m.values()) {
      list.sort(
        (a, b) =>
          new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
      );
    }
    return m;
  }, [entries]);

  const year = month.getFullYear();
  const mon = month.getMonth();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const firstWeekday = (new Date(year, mon, 1).getDay() + 6) % 7; // Monday = 0
  const todayKey = dayKey(new Date());
  const birthDate = new Date(birthAt);

  const cells: Array<Date | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, mon, i + 1)),
  ];

  const selected = selectedKey ? (byDay.get(selectedKey) ?? []) : [];
  const selectedDate = selectedKey
    ? new Date(`${selectedKey}T12:00:00`)
    : null;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        {/* Month header */}
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonth(new Date(year, mon - 1, 1))}
            className="rounded-full p-2 text-muted hover:bg-surface-alt hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-bold">
            {month.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </p>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonth(new Date(year, mon + 1, 1))}
            className="rounded-full p-2 text-muted hover:bg-surface-alt hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-faint mb-1">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <span key={`pad-${i}`} />;
            const k = dayKey(date);
            const dayEntries = byDay.get(k) ?? [];
            const feeds = dayEntries.filter((e) => e.type === "feed").length;
            const nappies = dayEntries.filter((e) => e.type === "nappy").length;
            const hasWeight = dayEntries.some((e) => e.type === "weight");
            const isSelected = selectedKey === k;
            const isToday = todayKey === k;
            const beforeBirth =
              date.getTime() <
              new Date(
                birthDate.getFullYear(),
                birthDate.getMonth(),
                birthDate.getDate()
              ).getTime();

            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelectedKey(k)}
                className={`flex min-h-14 flex-col items-center rounded-xl border px-0.5 pb-1 pt-0.5 transition ${
                  isSelected
                    ? "border-ink bg-ink text-white"
                    : dayEntries.length > 0
                      ? "border-line bg-surface-alt hover:border-ink"
                      : "border-transparent hover:bg-surface-alt"
                } ${beforeBirth ? "opacity-40" : ""}`}
              >
                <span
                  className={`stat-num text-xs leading-5 ${
                    isToday && !isSelected
                      ? "rounded-full bg-accent-soft px-1.5"
                      : ""
                  } ${
                    isSelected
                      ? "text-white"
                      : dayEntries.length > 0
                        ? "text-ink"
                        : "text-faint"
                  }`}
                >
                  {date.getDate()}
                </span>
                {dayEntries.length > 0 && (
                  <span
                    className={`flex flex-col items-center gap-px text-[9px] font-semibold leading-tight ${
                      isSelected ? "text-white/90" : "text-muted"
                    }`}
                  >
                    {feeds > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Milk className="h-2.5 w-2.5" /> {feeds}
                      </span>
                    )}
                    {nappies > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Baby className="h-2.5 w-2.5" /> {nappies}
                      </span>
                    )}
                    {hasWeight && (
                      <Scale
                        className={`h-2.5 w-2.5 ${
                          isSelected ? "text-white" : "text-positive"
                        }`}
                      />
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <Milk className="h-3 w-3" /> feeds
          </span>
          <span className="flex items-center gap-1">
            <Baby className="h-3 w-3" /> nappies
          </span>
          <span className="flex items-center gap-1">
            <Scale className="h-3 w-3 text-positive" /> weight logged
          </span>
        </p>
      </Card>

      {/* Selected day detail */}
      {selectedDate && (
        <section>
          <div className="mb-2 flex items-baseline justify-between px-2">
            <h2 className="text-sm font-bold">
              {selectedDate.getTime() >= birthDate.getTime() - 864e5 &&
                `Day ${dayOfLife(birthAt, selectedDate)} · `}
              {selectedDate.toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h2>
            {selected.length > 0 && <DayTotals entries={selected} />}
          </div>
          <Card className="px-5">
            {selected.length === 0 ? (
              <p className="py-5 text-sm text-muted">
                Nothing logged this day. Past days can be added in Log with a
                backdated time.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {selected.map((e) => (
                  <EntryRow
                    key={e.id}
                    entry={e}
                    photoUrl={e.photo_path ? photoUrls[e.photo_path] : undefined}
                    birthWeightG={birthWeightG}
                    canEdit={canEdit}
                    onPhotoClick={onPhotoClick}
                    nappyBaseWeightG={nappyBaseWeightG}
                  />
                ))}
              </ul>
            )}
          </Card>
        </section>
      )}
    </div>
  );
}

export function CalendarClient(props: {
  entries: Entry[];
  birthAt: string;
  birthWeightG: number;
  photoUrls: Record<string, string>;
  canEdit: boolean;
  nappyBaseWeightG?: number | null;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  return (
    <div className="space-y-4 animate-rise">
      <CalendarGrid {...props} onPhotoClick={setLightbox} />
      <p className="px-2 pb-2 text-center text-xs text-faint">{DISCLAIMER}</p>
      <PhotoLightbox url={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
