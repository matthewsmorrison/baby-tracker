"use client";
import { useRef, useState } from "react";
import { DISCLAIMER, dayOfLife } from "@/lib/clinical";
import { dayWithDate } from "@/lib/dates";
import { loadHistoryBefore, toggleDayTag } from "@/lib/actions";
import type { DayTag, DayTagKind, Entry } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { DayTotals, EntryRow, PhotoLightbox } from "./entryList";
import { CalendarGrid } from "./CalendarClient";

function Timeline({
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
              <h2 className="text-sm font-bold">{dayWithDate(birthAt, day)}</h2>
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
                    canEdit={canEdit}
                    onPhotoClick={onPhotoClick}
                    nappyBaseWeightG={nappyBaseWeightG}
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

export function HistoryClient({
  babyId,
  entries: initialEntries,
  birthAt,
  birthWeightG,
  photoUrls: initialPhotoUrls,
  canEdit,
  nappyBaseWeightG,
  initialSince,
  initialHasMore,
  initialDayTags,
}: {
  babyId: string;
  entries: Entry[];
  birthAt: string;
  birthWeightG: number;
  photoUrls: Record<string, string>;
  canEdit: boolean;
  nappyBaseWeightG?: number | null;
  /** Start of the window the server shipped; older windows load on demand. */
  initialSince: string;
  initialHasMore: boolean;
  initialDayTags: DayTag[];
}) {
  const [view, setView] = useState<"calendar" | "timeline">("calendar");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [entries, setEntries] = useState(initialEntries);
  const [photoUrls, setPhotoUrls] = useState(initialPhotoUrls);
  const [since, setSince] = useState(initialSince);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // Guards against overlapping loads across the async awaits below.
  const loadingRef = useRef(false);
  // day ("YYYY-MM-DD") -> tags on that day, kept as a map for the calendar.
  const tagMap = (tags: DayTag[]) => {
    const m: Record<string, DayTagKind[]> = {};
    for (const t of tags) (m[t.day] ??= []).push(t.tag);
    return m;
  };
  const [dayTags, setDayTags] = useState<Record<string, DayTagKind[]>>(() =>
    tagMap(initialDayTags)
  );

  // router.refresh() — fired by the log forms after every save and by the
  // resume handler when the app reopens — re-renders this component with
  // fresh server props. Local pagination state must re-seed from them or the
  // page keeps showing the stale copy it captured on first mount. Older
  // windows the user had paged in are dropped on purpose: they may have
  // changed too, and "load older" brings them back fresh. (Render-phase
  // reset — React's supported pattern for deriving state from props.)
  const [seededFrom, setSeededFrom] = useState(initialEntries);
  if (seededFrom !== initialEntries) {
    setSeededFrom(initialEntries);
    setEntries(initialEntries);
    setPhotoUrls(initialPhotoUrls);
    setSince(initialSince);
    setHasMore(initialHasMore);
    setDayTags(tagMap(initialDayTags));
  }

  // Optimistic toggle; reverts if the server action fails.
  async function onToggleTag(day: string, tag: DayTagKind) {
    const flip = () =>
      setDayTags((prev) => {
        const cur = prev[day] ?? [];
        const next = cur.includes(tag)
          ? cur.filter((t) => t !== tag)
          : [...cur, tag];
        return { ...prev, [day]: next };
      });
    flip();
    const res = await toggleDayTag(babyId, day, tag);
    if (res.error) flip();
  }

  async function loadWindow(cursor: string) {
    const page = await loadHistoryBefore(babyId, cursor);
    setEntries((prev) => {
      const seen = new Set(prev.map((e) => e.id));
      return [...prev, ...page.entries.filter((e) => !seen.has(e.id))];
    });
    setPhotoUrls((prev) => ({ ...prev, ...page.photoUrls }));
    setSince(page.since);
    setHasMore(page.hasMore);
    return page;
  }

  async function loadOlder() {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingOlder(true);
    try {
      await loadWindow(since);
    } finally {
      loadingRef.current = false;
      setLoadingOlder(false);
    }
  }

  // Calendar month nav: keep pulling older windows until the viewed month is
  // covered, so its day counts don't show as misleadingly empty.
  async function ensureMonthLoaded(monthStart: Date) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadingOlder(true);
    try {
      let cursor = since;
      let more = hasMore;
      while (more && new Date(cursor) > monthStart) {
        const page = await loadWindow(cursor);
        cursor = page.since;
        more = page.hasMore;
      }
    } finally {
      loadingRef.current = false;
      setLoadingOlder(false);
    }
  }

  if (entries.length === 0 && !hasMore) {
    return (
      <Card className="p-6 text-center animate-rise">
        <p className="font-semibold">Nothing logged yet</p>
        <p className="mt-1 text-sm text-muted">
          Tap the + button to log a feed, nappy or weight — including past
          days you backdate.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-rise">
      <Segmented<"calendar" | "timeline">
        options={[
          { value: "calendar", label: "Calendar" },
          { value: "timeline", label: "Timeline" },
        ]}
        value={view}
        onChange={setView}
      />

      {view === "calendar" ? (
        <>
          <CalendarGrid
            entries={entries}
            birthAt={birthAt}
            birthWeightG={birthWeightG}
            photoUrls={photoUrls}
            canEdit={canEdit}
            onPhotoClick={setLightbox}
            nappyBaseWeightG={nappyBaseWeightG}
            onMonthChange={ensureMonthLoaded}
            dayTags={dayTags}
            onToggleTag={canEdit ? onToggleTag : undefined}
          />
          {loadingOlder && (
            <p className="text-center text-xs text-faint">Loading older entries…</p>
          )}
        </>
      ) : (
        <>
          <Timeline
            entries={entries}
            birthAt={birthAt}
            birthWeightG={birthWeightG}
            photoUrls={photoUrls}
            canEdit={canEdit}
            onPhotoClick={setLightbox}
            nappyBaseWeightG={nappyBaseWeightG}
          />
          {hasMore && (
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="w-full rounded-2xl border border-line py-3 text-sm font-medium text-muted transition hover:border-ink hover:text-ink disabled:opacity-60"
            >
              {loadingOlder ? "Loading…" : "Load older entries"}
            </button>
          )}
        </>
      )}

      <p className="px-2 pb-2 text-center text-xs text-faint">{DISCLAIMER}</p>
      <PhotoLightbox url={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
