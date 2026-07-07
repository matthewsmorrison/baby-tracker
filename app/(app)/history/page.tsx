/* eslint-disable @next/next/no-img-element */
import { getBabyContext, getEntries } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { DISCLAIMER, STOOL_COLOURS, dayOfLife, summariseFeeds } from "@/lib/clinical";
import { entryLabel } from "@/lib/entryDisplay";
import { formatTime } from "@/lib/dates";
import type { Entry } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { AiActionChip } from "@/components/output/AiVerdict";
import { Baby, Droplets, Milk, Scale } from "lucide-react";

function EntryIcon({ entry }: { entry: Entry }) {
  const cls = "h-4 w-4";
  if (entry.type === "feed") return <Milk className={cls} />;
  if (entry.type === "weight") return <Scale className={cls} />;
  if (entry.wet && !entry.dirty) return <Droplets className={cls} />;
  return <Baby className={cls} />;
}

export default async function HistoryPage() {
  const ctx = await getBabyContext();
  const entries = await getEntries(ctx.baby.id); // newest first

  // Short-TTL signed URLs for photo thumbnails (private bucket).
  const photoPaths = entries.filter((e) => e.photo_path).map((e) => e.photo_path!);
  const photoUrls = new Map<string, string>();
  if (photoPaths.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.storage
      .from("nappy-photos")
      .createSignedUrls(photoPaths, 600);
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) photoUrls.set(item.path, item.signedUrl);
    }
  }

  // Group by day of life, newest day first (entries are already newest-first).
  const groups = new Map<number, Entry[]>();
  for (const e of entries) {
    const day = dayOfLife(ctx.baby.birth_at, e.occurred_at);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(e);
  }
  const days = [...groups.keys()].sort((a, b) => b - a);

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
    <div className="space-y-5 animate-rise">
      {days.map((day) => {
        const dayEntries = groups.get(day)!;
        const nappies = dayEntries.filter((e) => e.type === "nappy");
        const wet = nappies.filter((e) => e.wet).length;
        const dirty = nappies.filter((e) => e.dirty).length;
        const feeds = summariseFeeds(dayEntries);

        return (
          <section key={day}>
            <div className="mb-2 flex items-baseline justify-between px-2">
              <h2 className="text-sm font-bold">Day {day}</h2>
              <p className="text-xs text-muted">
                {wet} wet · {dirty} dirty · {feeds.sessions} feeds
                {feeds.formulaMl > 0 && ` · ${feeds.formulaMl} ml formula`}
              </p>
            </div>
            <Card className="px-5">
              <ul className="divide-y divide-line">
                {dayEntries.map((e) => {
                  const url = e.photo_path ? photoUrls.get(e.photo_path) : null;
                  return (
                    <li key={e.id} className="flex items-start gap-3 py-3.5">
                      {url ? (
                        <img
                          src={url}
                          alt="Nappy photo"
                          className="h-10 w-10 shrink-0 rounded-xl object-cover border border-line"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-alt text-muted">
                          <EntryIcon entry={e} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{entryLabel(e)}</p>
                          {e.stool_colour && (
                            <span
                              title={STOOL_COLOURS[e.stool_colour].label}
                              className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/10"
                              style={{
                                background: STOOL_COLOURS[e.stool_colour].swatch,
                              }}
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted">
                          {formatTime(e.occurred_at)}
                        </p>
                        {e.ai?.action && (
                          <div className="mt-1.5">
                            <AiActionChip action={e.ai.action} />
                          </div>
                        )}
                        {e.note && (
                          <p className="mt-1 text-xs text-muted italic">
                            “{e.note}”
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        );
      })}
      <p className="px-2 pb-2 text-center text-xs text-faint">{DISCLAIMER}</p>
    </div>
  );
}
