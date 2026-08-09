import { getBabyContext, getEntries } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { HistoryClient } from "@/components/output/HistoryClient";

export default async function HistoryPage() {
  const ctx = await getBabyContext();
  // Medication courses are an ongoing state managed in Profile, not discrete
  // log events — but one-off DOSES ("Calpol 2.5 ml · given") are exactly the
  // kind of moment the chronological feed is for.
  const entries = (await getEntries(ctx.baby.id)).filter(
    (e) => e.type !== "medication" || e.med_kind === "dose"
  ); // newest first

  // Short-TTL signed URLs for photo thumbnails (private bucket).
  const photoPaths = entries.filter((e) => e.photo_path).map((e) => e.photo_path!);
  const photoUrls: Record<string, string> = {};
  if (photoPaths.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.storage
      .from("nappy-photos")
      .createSignedUrls(photoPaths, 600);
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) photoUrls[item.path] = item.signedUrl;
    }
  }

  return (
    <HistoryClient
      entries={entries}
      birthAt={ctx.baby.birth_at}
      birthWeightG={ctx.baby.birth_weight_g}
      photoUrls={photoUrls}
      canEdit={ctx.canEdit}
      nappyBaseWeightG={ctx.baby.nappy_base_weight_g}
    />
  );
}
