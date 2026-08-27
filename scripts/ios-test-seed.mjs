// Creates a throwaway user + baby + realistic entries for iOS simulator
// testing, and mints session tokens via the admin API. Cleaned up by
// ios-test-teardown (delete user cascades nothing on babies — baby is
// deleted explicitly by id, printed here).
import { createRequire } from "module";
import { mkdirSync } from "fs";
mkdirSync("ios/build", { recursive: true });
import { readFileSync, writeFileSync } from "fs";
const require = createRequire(process.cwd() + "/package.json");
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n").filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).split("#")[0].trim()]; })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const email = `ios-sim-test-${Date.now()}@example.com`;
const { data: userData, error: uErr } = await admin.auth.admin.createUser({ email, email_confirm: true });
if (uErr) throw uErr;
const userId = userData.user.id;

// Baby born 16 days ago, realistic day of newborn logging.
const birth = new Date(Date.now() - 15.6 * 864e5);
const babyId = crypto.randomUUID();
let { error: bErr } = await admin.from("babies").insert({
  id: babyId, name: "Juno", birth_at: birth.toISOString(), birth_weight_g: 3420, sex: "girl",
  created_by: userId, feed_interval_min: 180,
  membership_tier: "advanced", tracked_types: ["nappy", "feed", "sleep", "weight", "pump", "temperature", "medication", "milestone"],
});
if (bErr) throw bErr;
await admin.from("baby_members").upsert({ baby_id: babyId, user_id: userId, role: "owner" }, { onConflict: "baby_id,user_id" });

// Seed ~5 days of entries: feeds every ~3h, nappies, sleeps, weights.
const rows = [];
const now = Date.now();
for (let d = 0; d < 6; d++) {
  const dayStart = now - d * 864e5;
  for (let f = 0; f < 8; f++) {
    const t = new Date(dayStart - f * 3 * 36e5 - Math.random() * 30 * 6e4);
    if (t.getTime() > now) continue;
    const bottle = f % 4 === 3;
    rows.push({
      baby_id: babyId, type: "feed", occurred_at: t.toISOString(), created_by: userId,
      ended_at: new Date(t.getTime() + 25 * 6e4).toISOString(),
      feed_type: bottle ? "expressed" : "breast",
      left_min: bottle ? null : 8 + Math.floor(Math.random() * 12),
      right_min: bottle ? null : 5 + Math.floor(Math.random() * 12),
      expressed_ml: bottle ? 70 + Math.floor(Math.random() * 40) : null,
    });
  }
  for (let n = 0; n < 6 + (d % 2); n++) {
    const t = new Date(dayStart - n * 3.4 * 36e5 - Math.random() * 60 * 6e4);
    if (t.getTime() > now) continue;
    rows.push({
      baby_id: babyId, type: "nappy", occurred_at: t.toISOString(), created_by: userId,
      wet: true, dirty: n % 3 === 0,
    });
  }
  for (let s = 0; s < 4; s++) {
    const t = new Date(dayStart - (s * 5.5 + 1.2) * 36e5);
    if (t.getTime() > now) continue;
    rows.push({
      baby_id: babyId, type: "sleep", occurred_at: t.toISOString(), created_by: userId,
      ended_at: new Date(Math.min(t.getTime() + (1.5 + Math.random() * 2) * 36e5, now)).toISOString(),
    });
  }
}
[15, 11, 7, 3].forEach((daysAgo, i) => {
  rows.push({
    baby_id: babyId, type: "weight", occurred_at: new Date(now - daysAgo * 864e5).toISOString(),
    created_by: userId, weight_g: 3420 - 180 + i * 150,
  });
});
rows.push({
  baby_id: babyId, type: "medication", med_kind: "dose", med_subject: "baby",
  med_name: "Vitamin D", med_dose: "1 drop", occurred_at: new Date(now - 3 * 36e5).toISOString(),
  created_by: userId,
});
// Insert per type (bulk insert unions keys across rows — med_kind not-null default).
for (const type of ["feed", "nappy", "sleep", "weight", "medication"]) {
  const group = rows.filter(r => r.type === type);
  if (!group.length) continue;
  const { error } = await admin.from("entries").insert(group);
  if (error) throw new Error(`${type}: ${error.message}`);
}
await admin.from("baby_day_tags").insert({
  baby_id: babyId, day: new Date(now - 864e5).toISOString().slice(0, 10),
  tag: "no_poo", created_by: userId,
});

// Mint tokens: generate a magic link, redeem its token_hash for a session.
const { data: linkData, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (lErr) throw lErr;
const tokenHash = linkData.properties.hashed_token;
const verifyRes = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
  body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }),
});
const session = await verifyRes.json();
if (!session.access_token) throw new Error("verify failed: " + JSON.stringify(session).slice(0, 200));

writeFileSync("ios/build/test-session.json", JSON.stringify({
  userId, babyId, email,
  accessToken: session.access_token,
  refreshToken: session.refresh_token,
}, null, 2));
console.log("seeded", { userId, babyId, entries: rows.length });
