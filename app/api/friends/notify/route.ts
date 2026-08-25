import { NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/supabase/route";
import { createServiceClient } from "@/lib/supabase/service";
import { sendToUsers } from "@/lib/push";

/**
 * Push notification for a direct message the native app just sent (the
 * message itself is inserted client-side through RLS — contents stay
 * encrypted; this only announces that something arrived).
 */
export async function POST(request: Request) {
  const auth = await getRouteAuth(request);
  if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { recipientId?: string; kind?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const recipientId = body.recipientId ?? "";
  if (!/^[0-9a-f-]{36}$/.test(recipientId)) {
    return NextResponse.json({ error: "Bad recipient" }, { status: 400 });
  }

  // Only for an accepted friendship — checked through the caller's RLS.
  const { data: friendship } = await auth.supabase
    .from("friendships")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(requester.eq.${auth.userId},addressee.eq.${recipientId}),and(requester.eq.${recipientId},addressee.eq.${auth.userId})`
    )
    .maybeSingle();
  if (!friendship) {
    return NextResponse.json({ error: "Not friends" }, { status: 403 });
  }

  const { data: me } = await createServiceClient()
    .from("profiles")
    .select("full_name, email")
    .eq("id", auth.userId)
    .maybeSingle();
  const name = me?.full_name || me?.email || "A friend";

  const wave = body.kind === "wave";
  const sent = await sendToUsers([recipientId], {
    title: wave ? `${name} waved at you 👋` : `${name} messaged you`,
    body: wave ? "They're up too. Wave back?" : "Open beanlo to read it.",
    url: `/friends/${auth.userId}`,
    tag: `dm-${auth.userId}`,
  });
  return NextResponse.json({ ok: true, sent });
}
