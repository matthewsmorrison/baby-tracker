// Infer combined feeds: cluster separate feed entries that belong to one
// feeding session and merge them into single combined entries.
//
// Rule: a feed joins the current cluster if it starts within GAP_MIN minutes
// of the cluster's end (nursing end = start + minutes; bottles are treated
// as instantaneous). Clusters are capped at SPAN_MAX minutes total.
//
// Usage: node scripts/merge-feeds.mjs          (dry run — prints the plan)
//        node scripts/merge-feeds.mjs --apply  (backs up originals, merges)
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";

const GAP_MIN = 60; // next feed starting within an hour of the last ending = same feed
const SPAN_MAX = 120; // but a single feed never spans more than 2 hours of starts
const APPLY = process.argv.includes("--apply");
const BACKUP = `/private/tmp/claude-502/-Users-matthewmorrison-Desktop-baby-tracker/d679710c-c933-4646-bcb8-c4f79598de0b/scratchpad/merged-feeds-backup-${Date.now()}.json`;

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).split("#")[0].trim()];
    })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const { data: babies } = await admin.from("babies").select("id, name").ilike("name", "asher");
if (babies?.length !== 1) throw new Error("Expected exactly one baby named Asher");
const baby = babies[0];

const { data: feeds } = await admin
  .from("entries")
  .select("*")
  .eq("baby_id", baby.id)
  .eq("type", "feed")
  .order("occurred_at", { ascending: true });

const amounts = (e) => ({
  left: e.left_min ?? 0,
  right: e.right_min ?? 0,
  expressed: e.expressed_ml ?? (e.feed_type === "expressed" ? (e.volume_ml ?? 0) : 0),
  formula: e.formula_ml ?? (e.feed_type === "formula" ? (e.volume_ml ?? 0) : 0),
});
const endOf = (e) => {
  const a = amounts(e);
  const nursingEnd =
    new Date(e.occurred_at).getTime() + (a.left + a.right) * 60_000;
  const explicit = e.ended_at ? new Date(e.ended_at).getTime() : 0;
  return Math.max(nursingEnd, explicit);
};
const t = (iso) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

// Cluster
const clusters = [];
let cur = null;
for (const f of feeds ?? []) {
  const start = new Date(f.occurred_at).getTime();
  if (
    cur &&
    start - cur.end <= GAP_MIN * 60_000 &&
    start - new Date(cur.items[0].occurred_at).getTime() <= SPAN_MAX * 60_000
  ) {
    cur.items.push(f);
    cur.end = Math.max(cur.end, endOf(f));
  } else {
    cur = { items: [f], end: endOf(f) };
    clusters.push(cur);
  }
}

const toMerge = clusters.filter((c) => c.items.length > 1);
if (toMerge.length === 0) {
  console.log("No adjacent feed entries to merge — nothing to do.");
  process.exit(0);
}

console.log(`${APPLY ? "MERGING" : "DRY RUN — would merge"} ${toMerge.length} cluster(s):\n`);
const plans = [];
for (const c of toMerge) {
  const base = c.items[0];
  const sum = { left: 0, right: 0, expressed: 0, formula: 0 };
  const notes = [];
  for (const e of c.items) {
    const a = amounts(e);
    sum.left += a.left;
    sum.right += a.right;
    sum.expressed += a.expressed;
    sum.formula += a.formula;
    if (e.note) notes.push(e.note);
    for (const v of Object.values(e.feed_notes ?? {})) notes.push(v);
  }
  const hasBreast = sum.left + sum.right > 0;
  const hasBottle = sum.expressed + sum.formula > 0;
  const feedType =
    hasBreast && hasBottle
      ? "mixed"
      : hasBreast
        ? "breast"
        : sum.expressed && sum.formula
          ? "mixed"
          : sum.expressed
            ? "expressed"
            : "formula";
  const parts = [];
  if (sum.left) parts.push(`L${sum.left}m`);
  if (sum.right) parts.push(`R${sum.right}m`);
  if (sum.expressed) parts.push(`EBM ${sum.expressed}ml`);
  if (sum.formula) parts.push(`formula ${sum.formula}ml`);

  console.log(
    `  ${t(base.occurred_at)} – ${t(new Date(c.end).toISOString()).slice(-5)}  ` +
      `(${c.items.length} entries → 1)  ${parts.join(" + ")}` +
      (notes.length ? `  notes: ${notes.join(" · ")}` : "")
  );

  plans.push({
    baseId: base.id,
    deleteIds: c.items.slice(1).map((e) => e.id),
    originals: c.items,
    update: {
      occurred_at: base.occurred_at,
      ended_at: new Date(c.end).toISOString(),
      feed_type: feedType,
      left_min: sum.left || null,
      right_min: sum.right || null,
      expressed_ml: sum.expressed || null,
      formula_ml: sum.formula || null,
      volume_ml: null,
      note: notes.length ? [...new Set(notes)].join(" · ") : null,
    },
  });
}

if (!APPLY) {
  console.log("\nRe-run with --apply to perform the merge.");
  process.exit(0);
}

writeFileSync(BACKUP, JSON.stringify(plans.map((p) => p.originals).flat(), null, 2));
console.log(`\nBacked up ${plans.map((p) => p.originals).flat().length} original rows to:\n  ${BACKUP}\n`);

for (const p of plans) {
  const { error: upErr } = await admin.from("entries").update(p.update).eq("id", p.baseId);
  if (upErr) throw new Error(`update ${p.baseId}: ${upErr.message}`);
  const { error: delErr } = await admin.from("entries").delete().in("id", p.deleteIds);
  if (delErr) throw new Error(`delete: ${delErr.message}`);
}
console.log(`Done: ${toMerge.length} combined feeds created, ${plans.reduce((n, p) => n + p.deleteIds.length, 0)} rows folded in.`);
