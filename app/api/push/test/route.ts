import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendToUsers } from "@/lib/push";

export const runtime = "nodejs";

// Send a test notification to the signed-in user's devices.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const sent = await sendToUsers([user.id], {
    title: "hearth",
    body: "Notifications are on — you’ll get gentle nudges here.",
    url: "/today",
    tag: "hearth-test",
  });
  return NextResponse.json({ ok: true, sent });
}
