import {
  HISTORY_WINDOW_DAYS,
  getBabyContext,
  getEntriesRange,
  hasEntriesBefore,
  signPhotoUrls,
} from "@/lib/data";
import { HistoryClient } from "@/components/output/HistoryClient";

export default async function HistoryPage() {
  const ctx = await getBabyContext();
  // Only the most recent window ships with the page — older windows stream in
  // on demand (timeline "load older" / calendar month navigation), so the
  // cold load stays flat however much history builds up.
  const since = new Date(
    new Date().getTime() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  // Medication courses are an ongoing state managed in Profile, not discrete
  // log events — but one-off DOSES ("Calpol 2.5 ml · given") are exactly the
  // kind of moment the chronological feed is for.
  const entries = (await getEntriesRange(ctx.baby.id, { since })).filter(
    (e) => e.type !== "medication" || e.med_kind === "dose"
  ); // newest first

  const [photoUrls, hasMore] = await Promise.all([
    signPhotoUrls(entries),
    hasEntriesBefore(ctx.baby.id, since),
  ]);

  return (
    <HistoryClient
      babyId={ctx.baby.id}
      entries={entries}
      birthAt={ctx.baby.birth_at}
      birthWeightG={ctx.baby.birth_weight_g}
      photoUrls={photoUrls}
      canEdit={ctx.canEdit}
      nappyBaseWeightG={ctx.baby.nappy_base_weight_g}
      initialSince={since}
      initialHasMore={hasMore}
    />
  );
}
