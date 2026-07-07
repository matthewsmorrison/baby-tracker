"use client";
import { useState } from "react";
import { DISCLAIMER, dayOfLife } from "@/lib/clinical";
import { dayWithDate } from "@/lib/dates";
import type { Entry } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { DayTotals, EntryRow, PhotoLightbox } from "./entryList";

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
  entries,
  birthAt,
  birthWeightG,
  photoUrls,
  canEdit,
  nappyBaseWeightG,
}: {
  entries: Entry[];
  birthAt: string;
  birthWeightG: number;
  photoUrls: Record<string, string>;
  canEdit: boolean;
  nappyBaseWeightG?: number | null;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);

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
      <Timeline
        entries={entries}
        birthAt={birthAt}
        birthWeightG={birthWeightG}
        photoUrls={photoUrls}
        canEdit={canEdit}
        onPhotoClick={setLightbox}
        nappyBaseWeightG={nappyBaseWeightG}
      />
      <p className="px-2 pb-2 text-center text-xs text-faint">{DISCLAIMER}</p>
      <PhotoLightbox url={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
