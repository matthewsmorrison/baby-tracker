// Live RLS security tests against the real Supabase project.
// Creates 3 throwaway users (parent A, outsider B, viewer V), exercises every
// policy, prints PASS/FAIL, and cleans everything up.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).split("#")[0].trim()];
    })
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SECRET_KEY;

const admin = createClient(URL_, SECRET, { auth: { persistSession: false } });

let pass = 0,
  fail = 0;
function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}  ${detail}`);
  }
}

const stamp = Date.now();
const emails = {
  A: `hearth-test-a-${stamp}@example.com`,
  B: `hearth-test-b-${stamp}@example.com`,
  V: `hearth-test-v-${stamp}@example.com`,
};
const PW = `Str0ng!pass-${stamp}`;

async function makeUser(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

async function signIn(email) {
  const c = createClient(URL_, PUB, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return c;
}

const ids = {};
let babyId = null;
let entryId = null;
const photoPath = () => `${babyId}/test-photo.jpg`;

try {
  console.log("Setting up test users…");
  ids.A = await makeUser(emails.A);
  ids.B = await makeUser(emails.B);
  ids.V = await makeUser(emails.V);
  const A = await signIn(emails.A);
  const B = await signIn(emails.B);
  const V = await signIn(emails.V);

  // --- Parent A creates a baby + entries -----------------------------------
  console.log("\n[A] owner setup");
  babyId = crypto.randomUUID();
  {
    const { error } = await A.from("babies").insert({
      id: babyId,
      name: "RLS Test Baby",
      birth_at: new Date(Date.now() - 5 * 864e5).toISOString(),
      birth_weight_g: 3800,
      created_by: ids.A,
    });
    check("A can create a baby", !error, error?.message);
  }
  {
    const { data } = await A.from("baby_members").select("*").eq("baby_id", babyId);
    check(
      "trigger made A the owner",
      data?.length === 1 && data[0].role === "owner" && data[0].user_id === ids.A
    );
  }
  {
    const { data, error } = await A.from("entries")
      .insert({
        baby_id: babyId,
        type: "nappy",
        occurred_at: new Date().toISOString(),
        wet: true,
        dirty: false,
        created_by: ids.A,
      })
      .select("id")
      .single();
    check("A can insert an entry", !error && !!data, error?.message);
    entryId = data?.id;
  }
  {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3])], {
      type: "image/jpeg",
    });
    const { error } = await A.storage.from("nappy-photos").upload(photoPath(), blob, {
      contentType: "image/jpeg",
      upsert: true,
    });
    check("A can upload a photo to the baby's folder", !error, error?.message);
  }

  // --- Outsider B: total isolation ------------------------------------------
  console.log("\n[B] outsider (no membership) — everything must be blocked");
  {
    const { data } = await B.from("babies").select("*").eq("id", babyId);
    check("B cannot read the baby", (data ?? []).length === 0);
  }
  {
    const { data } = await B.from("entries").select("*").eq("baby_id", babyId);
    check("B cannot read entries", (data ?? []).length === 0);
  }
  {
    const { error } = await B.from("entries").insert({
      baby_id: babyId,
      type: "feed",
      occurred_at: new Date().toISOString(),
      feed_type: "formula",
      volume_ml: 60,
      created_by: ids.B,
    });
    check("B cannot insert an entry (RLS error expected)", !!error, "insert was ALLOWED");
  }
  {
    const { data } = await B.from("babies")
      .update({ name: "hacked" })
      .eq("id", babyId)
      .select();
    check("B cannot update the baby", (data ?? []).length === 0);
  }
  {
    const { error: e1, data: d1 } = await B.storage
      .from("nappy-photos")
      .download(photoPath());
    check("B cannot download the photo", !!e1 && !d1, "download was ALLOWED");
  }
  {
    const { error } = await B.storage
      .from("nappy-photos")
      .createSignedUrl(photoPath(), 60);
    check("B cannot create a signed URL for the photo", !!error, "signing was ALLOWED");
  }
  {
    const { data } = await B.from("baby_members").select("*").eq("baby_id", babyId);
    check("B cannot list members", (data ?? []).length === 0);
  }
  {
    const { error } = await B.from("baby_members").insert({
      baby_id: babyId,
      user_id: ids.B,
      role: "caregiver",
    });
    check("B cannot grant themselves membership", !!error, "self-grant ALLOWED");
  }
  {
    const { error } = await B.from("baby_invites").insert({
      baby_id: babyId,
      email: emails.B,
      role: "caregiver",
      invited_by: ids.B,
    });
    check("B cannot create an invite for A's baby", !!error, "invite ALLOWED");
  }

  // --- Viewer V: read yes, write no ----------------------------------------
  console.log("\n[V] healthcare viewer — read-only enforced by the DB");
  {
    const { error } = await admin
      .from("baby_members")
      .insert({ baby_id: babyId, user_id: ids.V, role: "viewer" });
    if (error) throw new Error(`admin add viewer: ${error.message}`);
  }
  {
    const { data } = await V.from("entries").select("*").eq("baby_id", babyId);
    check("V can read entries", (data ?? []).length >= 1);
  }
  {
    const { data } = await V.from("babies").select("name").eq("id", babyId);
    check("V can read the baby", (data ?? []).length === 1);
  }
  {
    const { error } = await V.from("entries").insert({
      baby_id: babyId,
      type: "weight",
      occurred_at: new Date().toISOString(),
      weight_g: 3700,
      created_by: ids.V,
    });
    check("V cannot insert entries", !!error, "insert was ALLOWED");
  }
  {
    const { data } = await V.from("entries")
      .update({ note: "viewer edit" })
      .eq("id", entryId)
      .select();
    check("V cannot update entries", (data ?? []).length === 0);
  }
  {
    const { data } = await V.from("entries").delete().eq("id", entryId).select();
    check("V cannot delete entries", (data ?? []).length === 0);
  }
  {
    const blob = new Blob([new Uint8Array([1])], { type: "image/jpeg" });
    const { error } = await V.storage
      .from("nappy-photos")
      .upload(`${babyId}/viewer-upload.jpg`, blob);
    check("V cannot upload photos", !!error, "upload was ALLOWED");
  }
  {
    const { error, data } = await V.storage.from("nappy-photos").download(photoPath());
    check("V can view photos (read-only access)", !error && !!data, error?.message);
  }
  {
    const { data } = await V.from("babies")
      .update({ birth_weight_g: 1 })
      .eq("id", babyId)
      .select();
    check("V cannot edit birth details", (data ?? []).length === 0);
  }
  {
    const { error } = await V.from("baby_invites").insert({
      baby_id: babyId,
      email: "x@example.com",
      role: "caregiver",
      invited_by: ids.V,
    });
    check("V cannot create invites", !!error, "invite ALLOWED");
  }
  {
    const { data } = await V.from("baby_members")
      .update({ role: "caregiver" })
      .eq("baby_id", babyId)
      .eq("user_id", ids.V)
      .select();
    check("V cannot escalate their own role", (data ?? []).length === 0);
  }

  // --- Caregiver invite / privacy extras ------------------------------------
  console.log("\n[misc] invites & profiles");
  {
    const { error } = await A.from("baby_invites").insert({
      baby_id: babyId,
      email: emails.B,
      role: "caregiver",
      invited_by: ids.A,
    });
    check("A (owner) can create an invite", !error, error?.message);
  }
  {
    const { data } = await B.from("baby_invites").select("email, role").eq("baby_id", babyId);
    check("B can see the invite addressed to their email", (data ?? []).length === 1);
  }
  {
    const { data } = await V.from("baby_invites").select("*").eq("baby_id", babyId);
    check("V cannot see other people's invites", (data ?? []).length === 0);
  }
  {
    const { data } = await B.from("profiles").select("*").eq("id", ids.A);
    check("B cannot read A's profile (not co-members)", (data ?? []).length === 0);
  }
  {
    const { data } = await V.from("profiles").select("email").eq("id", ids.A);
    check("V (co-member) can see A's profile", (data ?? []).length === 1);
  }

  // --- Anonymous -------------------------------------------------------------
  console.log("\n[anon] unauthenticated client");
  {
    const anon = createClient(URL_, PUB, { auth: { persistSession: false } });
    const { data: d1 } = await anon.from("babies").select("*");
    const { data: d2 } = await anon.from("entries").select("*");
    check("anon sees no babies/entries", (d1 ?? []).length === 0 && (d2 ?? []).length === 0);
    const { data: d3, error: e3 } = await anon.storage
      .from("nappy-photos")
      .download(photoPath());
    check("anon cannot download photos", !!e3 && !d3, "download ALLOWED");
  }
} catch (e) {
  console.error("\nTest harness error:", e.message);
  fail++;
} finally {
  // --- Cleanup ---------------------------------------------------------------
  console.log("\nCleaning up…");
  try {
    if (babyId) {
      await admin.storage
        .from("nappy-photos")
        .remove([photoPath(), `${babyId}/viewer-upload.jpg`]);
      await admin.from("babies").delete().eq("id", babyId);
    }
    for (const uid of Object.values(ids)) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
    console.log("Cleanup complete.");
  } catch (e) {
    console.error("Cleanup issue (manual check advised):", e.message);
  }
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
