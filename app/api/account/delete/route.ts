import { NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/supabase/route";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * Account deletion for the native app (the web uses the deleteAccount server
 * action — same behaviour). Owned babies are deleted for everyone, photos
 * included; shared babies just lose this member. Requires the caller's own
 * verified token — the service role only acts on that user.
 */
export async function POST(request: Request) {
  const auth = await getRouteAuth(request);
  if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const service = createServiceClient();

  const { data: owned } = await service
    .from("baby_members")
    .select("baby_id")
    .eq("user_id", auth.userId)
    .eq("role", "owner");
  for (const m of owned ?? []) {
    const { data: files } = await service.storage
      .from("nappy-photos")
      .list(m.baby_id, { limit: 1000 });
    if (files?.length) {
      await service.storage
        .from("nappy-photos")
        .remove(files.map((f) => `${m.baby_id}/${f.name}`));
    }
    await service.from("babies").delete().eq("id", m.baby_id);
  }

  const { error } = await service.auth.admin.deleteUser(auth.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
