import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendToUsers } from "@/lib/push";
import { RATE_LIMITED, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Send a test notification to the signed-in user's devices.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!rateLimit(`push-test:${user.id}`, 5, 10 * 60_000)) {
    return NextResponse.json(RATE_LIMITED, { status: 429 });
  }

  const sent = await sendToUsers([user.id], {
    title: "beanlo",
    body: "Notifications are on — you’ll get gentle nudges here.",
    url: "/today",
    tag: "beanlo-test",
  });
  return NextResponse.json({ ok: true, sent });
}
