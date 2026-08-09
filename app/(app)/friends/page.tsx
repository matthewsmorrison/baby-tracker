import { createClient } from "@/lib/supabase/server";
import { getBabyContext } from "@/lib/data";
import { getFriendsData } from "@/lib/friends";
import { FriendsClient } from "@/components/friends/FriendsClient";
import type { Profile } from "@/lib/types";

export default async function FriendsPage() {
  const ctx = await getBabyContext();
  const supabase = await createClient();
  const [data, { data: me }] = await Promise.all([
    getFriendsData(ctx.userId),
    supabase.from("profiles").select("*").eq("id", ctx.userId).single(),
  ]);
  return <FriendsClient data={data} me={(me as Profile) ?? null} />;
}
