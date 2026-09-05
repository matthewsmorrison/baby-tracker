import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Keeps the App Review demo account permanently review-ready. Reviewers
// demonstrably sign in and exercise everything — including deleting the
// baby and changing the password — and the data goes stale within days
// anyway. Weekly (GitHub Actions), this:
//   1. re-asserts the documented password,
//   2. recreates the demo baby if it's gone (or aged past the newborn
//      window the app is built around),
//   3. tops entries up to "now" so Today looks alive.
// The credentials here match the App Store Connect review notes.
const DEMO_EMAIL = "appreview@beanlo.com";
const DEMO_PASSWORD = "Rev-MBXEjhCywhEY";
const RESET_AGE_DAYS = 60;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const authHash = createHash("sha256").update(auth).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  if (!secret || !timingSafeEqual(authHash, expectedHash)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const svc = createServiceClient();
  const results: string[] = [];

  // --- 1. The user, with the documented password ---------------------------
  const { data: users } = await svc.auth.admin.listUsers({ perPage: 500 });
  let user = users?.users.find((u) => u.email === DEMO_EMAIL);
  if (!user) {
    const { data, error } = await svc.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "App Review" },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    user = data.user;
    results.push("user recreated");
  } else {
    const { error } = await svc.auth.admin.updateUserById(user.id, {
      password: DEMO_PASSWORD,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    results.push("password re-asserted");
  }

  // --- 2. The baby ----------------------------------------------------------
  const { data: memberships } = await svc
    .from("baby_members")
    .select("baby:babies(id, birth_at)")
    .eq("user_id", user.id);
  let baby = (memberships?.[0] as { baby?: { id: string; birth_at: string } } | undefined)?.baby ?? null;

  const now = Date.now();
  if (baby) {
    const ageDays = (now - new Date(baby.birth_at).getTime()) / 86_400_000;
    if (ageDays > RESET_AGE_DAYS) {
      await svc.from("babies").delete().eq("id", baby.id);
      baby = null;
      results.push("baby aged out — resetting");
    }
  }
  if (!baby) {
    const birth = new Date(now - 12 * 86_400_000);
    const { data, error } = await svc
      .from("babies")
      .insert({
        name: "Sunny",
        birth_at: birth.toISOString(),
        birth_weight_g: 3390,
        sex: "boy",
        created_by: user.id,
        membership_tier: "advanced",
      })
      .select("id, birth_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    baby = data;
    // Anchor weigh-ins for the growth chart.
    await svc.from("entries").insert(
      [
        [0, 3390],
        [3, 3250],
        [6, 3310],
        [10, 3460],
      ].map(([day, g]) => ({
        baby_id: baby!.id,
        type: "weight",
        occurred_at: new Date(new Date(baby!.birth_at).getTime() + day * 86_400_000 + 10 * 3_600_000).toISOString(),
        created_by: user!.id,
        weight_g: g,
      }))
    );
    results.push("baby recreated");
  } else {
    // Keep membership tier demo-worthy (a reviewer may have downgraded it).
    await svc.from("babies").update({ membership_tier: "advanced" }).eq("id", baby.id);
  }

  // --- 3. Top entries up to now ---------------------------------------------
  const { data: latest } = await svc
    .from("entries")
    .select("occurred_at")
    .eq("baby_id", baby.id)
    .order("occurred_at", { ascending: false })
    .limit(1);
  const from = latest?.[0]
    ? new Date(latest[0].occurred_at).getTime()
    : new Date(baby.birth_at).getTime();

  const rows: Record<string, unknown>[] = [];
  for (
    let t = from + 3 * 3_600_000;
    t < now - 30 * 60_000;
    t += 3 * 3_600_000 + (Math.random() - 0.5) * 40 * 60_000
  ) {
    const at = new Date(t);
    rows.push({
      baby_id: baby.id, type: "feed", occurred_at: at.toISOString(), created_by: user.id,
      left_min: 8 + Math.floor(Math.random() * 8), right_min: 5 + Math.floor(Math.random() * 8),
    });
    const h = at.getUTCHours();
    if (h % 6 < 3) {
      rows.push({
        baby_id: baby.id, type: "nappy", occurred_at: new Date(t + 20 * 60_000).toISOString(),
        created_by: user.id, wet: true, dirty: h % 12 < 3, stool_colour: h % 12 < 3 ? "yellow" : null,
      });
    }
    if (h >= 9 && h < 12) {
      rows.push({
        baby_id: baby.id, type: "sleep", occurred_at: at.toISOString(),
        ended_at: new Date(t + 95 * 60_000).toISOString(), created_by: user.id,
      });
    }
  }
  for (const type of ["feed", "nappy", "sleep"]) {
    const chunk = rows.filter((r) => r.type === type);
    if (chunk.length) {
      const { error } = await svc.from("entries").insert(chunk);
      if (error) return NextResponse.json({ error: `${type}: ${error.message}` }, { status: 500 });
    }
  }
  // A weekly weigh-in continuing a plausible ~175g/week climb.
  const ageDays = Math.floor((now - new Date(baby.birth_at).getTime()) / 86_400_000);
  if (ageDays >= 12) {
    await svc.from("entries").insert({
      baby_id: baby.id, type: "weight", occurred_at: new Date(now - 5 * 3_600_000).toISOString(),
      created_by: user.id, weight_g: 3460 + Math.round((ageDays - 11) * 25),
    });
  }
  results.push(`topped up ${rows.length} entries`);

  return NextResponse.json({ ok: true, results });
}
