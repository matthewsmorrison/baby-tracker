"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import {
  DISCLAIMER,
  STOOL_COLOURS,
  dayOfLife,
  summariseFeeds,
  weightStatus,
} from "@/lib/clinical";
import { entryLabel } from "@/lib/entryDisplay";
import { formatTime } from "@/lib/dates";
import type { Entry } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { AiActionChip, AiVerdict } from "@/components/output/AiVerdict";
import {
  Baby,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Milk,
  Scale,
} from "lucide-react";

type View = "timeline" | "calendar";

function EntryIcon({ entry }: { entry: Entry }) {
  const cls = "h-4 w-4";
  if (entry.type === "feed") return <Milk className={cls} />;
  if (entry.type === "weight") return <Scale className={cls} />;
  if (entry.wet && !entry.dirty) return <Droplets className={cls} />;
  return <Baby className={cls} />;
}

/** Local-date key, e.g. "2026-07-04". */
function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * One read-only entry row, expandable: nappies reveal the colour, photo and
 * AI verdict; weights reveal % vs birth.
 */
function EntryRow({
  entry,
  photoUrl,
  birthWeightG,
}: {
  entry: Entry;
  photoUrl?: string;
  birthWeightG: number;
}) {
  const [open, setOpen] = useState(false);
  const expandable =
    (entry.type === "nappy" && (entry.stool_colour || entry.ai || photoUrl)) ||
    entry.type === "weight";
  const ws =
    entry.type === "weight" && entry.weight_g
      ? weightStatus(entry.weight_g, birthWeightG)
      : null;

  return (
    <li>
      <button
        type="button"
        onClick={() => expandable && setOpen(!open)}
        className={`flex w-full items-start gap-3 py-3.5 text-left ${
          expandable ? "cursor-pointer" : "cursor-default"
        }`}
        aria-expanded={expandable ? open : undefined}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Nappy photo"
            className="h-10 w-10 shrink-0 rounded-xl object-cover border border-line"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-alt text-muted">
            <EntryIcon entry={entry} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{entryLabel(entry)}</p>
            {entry.stool_colour && (
              <span
                title={STOOL_COLOURS[entry.stool_colour].label}
                className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/10"
                style={{ background: STOOL_COLOURS[entry.stool_colour].swatch }}
              />
            )}
          </div>
          <p className="text-xs text-muted">{formatTime(entry.occurred_at)}</p>
          {entry.ai?.action && !open && (
            <div className="mt-1.5">
              <AiActionChip action={entry.ai.action} />
            </div>
          )}
          {entry.note && (
            <p className="mt-1 text-xs text-muted italic">“{entry.note}”</p>
          )}
        </div>
        {expandable && (
          <ChevronRight
            className={`mt-1 h-4 w-4 shrink-0 text-faint transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
        )}
      </button>

      {open && (
        <div className="pb-4 space-y-3" style={{ paddingLeft: 52 }}>
          {entry.type === "nappy" && entry.stool_colour && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className="h-5 w-5 rounded-full border border-black/10"
                style={{ background: STOOL_COLOURS[entry.stool_colour].swatch }}
              />
              {STOOL_COLOURS[entry.stool_colour].label}
            </div>
          )}
          {photoUrl && (
            <img
              src={photoUrl}
              alt="Nappy photo enlarged"
              className="max-h-56 rounded-2xl border border-line object-contain"
            />
          )}
          {entry.ai && <AiVerdict ai={entry.ai} />}
          {ws && (
            <p
              className={`text-sm font-semibold stat-num ${
                ws.tone === "positive"
                  ? "text-positive"
                  : ws.tone === "alert"
                    ? "text-alert"
                    : ws.tone === "watch"
                      ? "text-[#A45A1B]"
                      : "text-ink"
              }`}
            >
              {ws.pct >= 0 ? "+" : ""}
              {ws.pct.toFixed(1)}% vs birth
              <span className="ml-2 font-normal text-muted text-xs">
                {ws.message}
              </span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function DayTotals({ entries }: { entries: Entry[] }) {
  const nappies = entries.filter((e) => e.type === "nappy");
  const wet = nappies.filter((e) => e.wet).length;
  const dirty = nappies.filter((e) => e.dirty).length;
  const feeds = summariseFeeds(entries);
  return (
    <p className="text-xs text-muted">
      {wet} wet · {dirty} dirty · {feeds.sessions} feeds
      {feeds.formulaMl > 0 && ` · ${feeds.formulaMl} ml formula`}
    </p>
  );
}

// ---------------------------------------------------------------------------

function Timeline({
  entries,
  birthAt,
  birthWeightG,
  photoUrls,
}: {
  entries: Entry[];
  birthAt: string;
  birthWeightG: number;
  photoUrls: Record<string, string>;
}) {
  const groups = new Map<number, Entry[]>();
  for (const e of entries) {
    const day = dayOfLife(birthAt, e.occurred_at);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(e);
  }
  const days = [...groups.keys()].sort((a, b) => b - a);

  return (
    <div className="space-y-5">
      {days.map((day) => {
        const dayEntries = groups.get(day)!;
        return (
          <section key={day}>
            <div className="mb-2 flex items-baseline justify-between px-2">
              <h2 className="text-sm font-bold">Day {day}</h2>
              <DayTotals entries={dayEntries} />
            </div>
            <Card className="px-5">
              <ul className="divide-y divide-line">
                {dayEntries.map((e) => (
                  <EntryRow
                    key={e.id}
                    entry={e}
                    photoUrl={e.photo_path ? photoUrls[e.photo_path] : undefined}
                    birthWeightG={birthWeightG}
                  />
                ))}
              </ul>
            </Card>
          </section>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

function CalendarView({
  entries,
  birthAt,
  birthWeightG,
  photoUrls,
}: {
  entries: Entry[];
  birthAt: string;
  birthWeightG: number;
  photoUrls: Record<string, string>;
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

// ---------------------------------------------------------------------------

export function HistoryClient({
  entries,
  birthAt,
  birthWeightG,
  photoUrls,
}: {
  entries: Entry[];
  birthAt: string;
  birthWeightG: number;
  photoUrls: Record<string, string>;
}) {
  const [view, setView] = useState<View>("timeline");

  if (entries.length === 0) {
    return (
      <Card className="p-6 text-center animate-rise">
        <p className="font-semibold">Nothing logged yet</p>
        <p className="mt-1 text-sm text-muted">
          Entries appear here as a day-by-day timeline — including any past
          days you backdate in Log.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-rise">
      <Segmented<View>
        options={[
          { value: "timeline", label: "Timeline" },
          { value: "calendar", label: "Calendar" },
        ]}
        value={view}
        onChange={setView}
      />

      {view === "timeline" ? (
        <Timeline
          entries={entries}
          birthAt={birthAt}
          birthWeightG={birthWeightG}
          photoUrls={photoUrls}
        />
      ) : (
        <CalendarView
          entries={entries}
          birthAt={birthAt}
          birthWeightG={birthWeightG}
          photoUrls={photoUrls}
        />
      )}

      <p className="px-2 pb-2 text-center text-xs text-faint">{DISCLAIMER}</p>
    </div>
  );
}
