import { NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/supabase/route";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Send a friend request by email — native-app twin of the sendFriendRequest
 * server action. The service client only performs the email→id lookup
 * (escaped, no wildcards); the insert runs through the caller's RLS client.
 */
export async function POST(request: Request) {
  const auth = await getRouteAuth(request);
  if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Enter an email address." }, { status: 400 });
  }

  const { data: target } = await createServiceClient()
    .from("profiles")
    .select("id")
    .ilike("email", email.replace(/[\\%_]/g, "\\$&"))
    .maybeSingle();
  if (!target) {
    return NextResponse.json(
      { error: "No Beanlo account with that email — they need to sign up first." },
      { status: 404 }
    );
  }
  if (target.id === auth.userId) {
    return NextResponse.json({ error: "That's you!" }, { status: 400 });
  }

  const { error } = await auth.supabase.from("friendships").insert({
    requester: auth.userId,
    addressee: target.id,
    status: "pending",
  });
  if (error) {
    return NextResponse.json(
      { error: "Couldn't send the request — you may already be connected." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
