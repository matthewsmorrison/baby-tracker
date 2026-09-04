// Deletes the throwaway world ios-test-seed.mjs created (baby cascade +
// auth user), reading ids from ios/build/test-session.json.
import { createRequire } from "module";
import { readFileSync, rmSync } from "fs";
const require = createRequire(process.cwd() + "/package.json");
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n").filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).split("#")[0].trim()]; })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const session = JSON.parse(readFileSync("ios/build/test-session.json", "utf8"));
const { error: bErr } = await admin.from("babies").delete().eq("id", session.babyId);
if (bErr) throw bErr;
const { error: uErr } = await admin.auth.admin.deleteUser(session.userId);
if (uErr) throw uErr;
if (session.onboardUserId) {
  // The onboarding test may have created a baby — deleting the auth user
  // does not cascade to it, so sweep those first.
  const { error: obErr } = await admin.from("babies").delete().eq("created_by", session.onboardUserId);
  if (obErr) throw obErr;
  const { error: ouErr } = await admin.auth.admin.deleteUser(session.onboardUserId);
  if (ouErr) throw ouErr;
}
rmSync("ios/build/test-session.json", { force: true });
console.log("TEARDOWN-OK", session.userId, session.onboardUserId ?? "");
