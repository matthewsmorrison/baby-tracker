import { getBabyContext, getEntries } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { HistoryClient } from "@/components/output/HistoryClient";

export default async function HistoryPage() {
  const ctx = await getBabyContext();
  const entries = await getEntries(ctx.baby.id); // newest first

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
