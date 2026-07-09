import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  DISCLAIMER,
  dayOfLife,
  estimatedUrineMl,
  expectedNappies,
  expectedWeightBand,
  formatKg,
  summariseFeeds,
  weightStatus,
} from "@/lib/clinical";
import { feedAmounts, feedGaps, formatGap } from "@/lib/entryDisplay";
import { ACTIVE_BABY_COOKIE } from "@/lib/data";
import type { Baby, Entry } from "@/lib/types";

// Ask questions of the baby's data. Server-only; the whole (small) dataset is
// serialized into a cached system prompt — no query tools needed at this
// scale, and turns 2+ read the data block from the prompt cache.

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
const MAX_TURNS = 24;
const MAX_MSG_CHARS = 4000;

function fmt(iso: string, tz: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleString("en-GB", { timeZone: tz, ...opts });
}

function serialise(baby: Baby, entries: Entry[], tz: string): string {
  const asc = [...entries].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  // --- per-day aggregates (do the arithmetic here, not in the model) ---
  const byDay = new Map<string, Entry[]>();
  for (const e of asc) {
    const k = fmt(e.occurred_at, tz, { year: "numeric", month: "2-digit", day: "2-digit" });
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(e);
  }
  const gaps = feedGaps(asc);
  const gapByDay = new Map<string, number[]>();
  for (const g of gaps) {
    const k = fmt(g.at.toISOString(), tz, { year: "numeric", month: "2-digit", day: "2-digit" });
    if (!gapByDay.has(k)) gapByDay.set(k, []);
    gapByDay.get(k)!.push(g.gapMs);
  }

  const dayLines: string[] = [];
  for (const [k, dayEntries] of byDay) {
    const day = dayOfLife(baby.birth_at, dayEntries[0].occurred_at);
    const f = summariseFeeds(dayEntries);
    const nappies = dayEntries.filter((e) => e.type === "nappy");
    const wet = nappies.filter((e) => e.wet).length;
    const dirty = nappies.filter((e) => e.dirty).length;
    const weights = dayEntries
      .filter((e) => e.type === "weight" && e.weight_g)
      .map((e) => `${e.weight_g}g (${weightStatus(e.weight_g!, baby.birth_weight_g).pct.toFixed(1)}% vs birth)`);
    const urine = nappies
      .map((e) => estimatedUrineMl(e, baby.nappy_base_weight_g))
      .filter((v): v is number => v !== null);
    // Sleep started this day (ended sessions only), in ms.
    const sleepMs = dayEntries
      .filter((e) => e.type === "sleep" && e.ended_at)
      .reduce(
        (s, e) =>
          s + (new Date(e.ended_at!).getTime() - new Date(e.occurred_at).getTime()),
        0
      );
    const dayGaps = gapByDay.get(k) ?? [];
    const avgGap = dayGaps.length
      ? formatGap(dayGaps.reduce((a, b) => a + b, 0) / dayGaps.length)
      : "n/a";
    const label = fmt(dayEntries[0].occurred_at, tz, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    dayLines.push(
      `Day ${day} (${label}): ${f.sessions} feeds (${f.breastMin}min nursing, ${f.expressedMl}ml EBM, ${f.formulaMl}ml formula, mix=${f.mix}); avg gap ${avgGap}; nappies ${wet} wet / ${dirty} dirty${urine.length ? `; est. urine ${urine.reduce((a, b) => a + b, 0)}ml from ${urine.length} weighed` : ""}${sleepMs > 0 ? `; sleep ${formatGap(sleepMs)}` : ""}${weights.length ? `; weight ${weights.join(", ")}` : ""}`
    );
  }

  // --- raw entries, one compact line each ---
  const lines = asc.map((e) => {
    const day = dayOfLife(baby.birth_at, e.occurred_at);
    const t = fmt(e.occurred_at, tz, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const end = e.ended_at
      ? `–${fmt(e.ended_at, tz, { hour: "2-digit", minute: "2-digit" })}`
      : "";
    if (e.type === "feed") {
      const a = feedAmounts(e);
      const parts = [
        a.left ? `L ${a.left}min` : null,
        a.right ? `R ${a.right}min` : null,
        a.expressed ? `EBM ${a.expressed}ml` : null,
        a.formula ? `formula ${a.formula}ml` : null,
      ].filter(Boolean);
      const notes = e.feed_notes
        ? Object.entries(e.feed_notes)
            .map(([k, v]) => `${k}: "${v}"`)
            .join(", ")
        : "";
      return `d${day} ${t}${end} FEED ${parts.join(" + ")}${notes ? ` [${notes}]` : ""}${e.note ? ` note:"${e.note}"` : ""}`;
    }
    if (e.type === "nappy") {
      const bits = [
        e.wet ? "wet" : null,
        e.dirty ? `dirty(${e.stool_colour ?? "?"})` : null,
        e.nappy_weight_g ? `${e.nappy_weight_g}g nappy` : null,
        e.ai
          ? `photo labels:${e.ai.stoolAmount ? ` poo=${e.ai.stoolAmount}` : ""}${e.ai.consistency ? ` texture=${e.ai.consistency}` : ""}${e.ai.estimatedUrineMl != null ? ` urine≈${e.ai.estimatedUrineMl}ml` : ""}`
          : null,
      ].filter(Boolean);
      return `d${day} ${t} NAPPY ${bits.join(", ")}${e.note ? ` note:"${e.note}"` : ""}`;
    }
    if (e.type === "sleep") {
      const dur = e.ended_at
        ? formatGap(new Date(e.ended_at).getTime() - new Date(e.occurred_at).getTime())
        : "ongoing";
      return `d${day} ${t}${end} SLEEP ${dur}${e.note ? ` note:"${e.note}"` : ""}`;
    }
    const band = expectedWeightBand(day, baby.birth_weight_g);
    return `d${day} ${t} WEIGHT ${e.weight_g}g (${weightStatus(e.weight_g!, baby.birth_weight_g).pct.toFixed(1)}% vs birth; expected ${band.low}–${band.high}g)${e.note ? ` note:"${e.note}"` : ""}`;
  });

  // --- rolling last-24h window (matches the app's Today screen exactly) ---
  const nowMs = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const windowStart = nowMs - DAY_MS;
  const last24 = asc.filter((e) => {
    const at = new Date(e.occurred_at).getTime();
    return at > windowStart && at <= nowMs;
  });
  const f24 = summariseFeeds(last24);
  const nappies24 = last24.filter((e) => e.type === "nappy");
  const wet24 = nappies24.filter((e) => e.wet).length;
  const dirty24 = nappies24.filter((e) => e.dirty).length;
  const urine24 = nappies24
    .map((e) => estimatedUrineMl(e, baby.nappy_base_weight_g))
    .filter((v): v is number => v !== null)
    .reduce((a, b) => a + b, 0);
  // Sleep overlapping the window (same partial-attribution as Today).
  const sleepMs24 = asc
    .filter((e) => e.type === "sleep" && e.ended_at)
    .reduce((s, e) => {
      const st = Math.max(new Date(e.occurred_at).getTime(), windowStart);
      const en = Math.min(new Date(e.ended_at!).getTime(), nowMs);
      return s + Math.max(0, en - st);
    }, 0);
  const day24 = dayOfLife(baby.birth_at, new Date());
  const exp = expectedNappies(day24);
  const rolling = `## Last 24 hours (rolling window ending right now — USE THIS for any "last 24 hours", "past day", "past 24h", "so far", or "recently" question. This is what the app's Today screen shows. Do NOT substitute a single calendar-day summary for it.)
- Feeds: ${f24.sessions} (${f24.breastMin}min nursing, ${f24.expressedMl}ml EBM, ${f24.formulaMl}ml formula, mix=${f24.mix})
- Nappies: ${nappies24.length} total — ${wet24} wet, ${dirty24} dirty${urine24 > 0 ? `; est. urine ${urine24}ml` : ""}. NCT guide for day ${day24}: about ${exp.total} nappies in 24h, at least ${exp.minDirty} with poo.
- Sleep: ${Math.round((sleepMs24 / 3_600_000) * 10) / 10}h`;

  return `${rolling}

## Daily summaries (pre-computed, per CALENDAR DAY — midnight to midnight in the family's timezone. Use these for a specific date or day of life, and for day-to-day comparisons. Do NOT use one of these as "the last 24 hours".)
${dayLines.join("\n")}

## Raw entries
${lines.join("\n")}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { messages?: Array<{ role: string; content: string }>; tz?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const tz = typeof body.tz === "string" && body.tz.length < 64 ? body.tz : "UTC";
  const history = (body.messages ?? [])
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .slice(-MAX_TURNS)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.slice(0, MAX_MSG_CHARS),
    }));
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "No question" }, { status: 400 });
  }

  // Active baby (same cookie logic as the pages), through RLS.
  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_BABY_COOKIE)?.value;
  const { data: memberships } = await supabase
    .from("baby_members")
    .select("baby:babies(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  const babies = (memberships ?? [])
    .map((m) => m.baby as unknown as Baby)
    .filter(Boolean);
  const baby = babies.find((b) => b.id === activeId) ?? babies[0];
  if (!baby) return NextResponse.json({ error: "No baby" }, { status: 404 });
  if (baby.membership_tier !== "advanced") {
    return NextResponse.json(
      { error: "Ask is part of the Advanced membership." },
      { status: 403 }
    );
  }

  const { data: entries } = await supabase
    .from("entries")
    .select("*")
    .eq("baby_id", baby.id)
    .order("occurred_at", { ascending: true });

  const { data: notes } = await supabase
    .from("baby_notes")
    .select("kind, body, answer, answered_at, created_at")
    .eq("baby_id", baby.id)
    .order("created_at", { ascending: true });

  const notesBlock =
    (notes ?? []).length > 0
      ? "\n\n## Parent's notes & questions\n" +
        (notes ?? [])
          .map((n) => {
            const when = fmt(n.created_at, tz, { day: "numeric", month: "short" });
            if (n.kind === "note") return `(${when}) NOTE: ${n.body}`;
            return `(${when}) Q: ${n.body}${n.answer ? `\n    A: ${n.answer}` : " (unanswered)"}`;
          })
          .join("\n")
      : "";

  const today = dayOfLife(baby.birth_at, new Date());
  const framing = `You are the assistant inside "hearth", a newborn tracking app, answering a parent's (or their healthcare professional's) questions about ${baby.name}'s logged data.

Facts: ${baby.name} was born ${fmt(baby.birth_at, tz, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} (birth weight ${formatKg(baby.birth_weight_g)}); today is day ${today} of life, ${new Date().toLocaleDateString("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long" })}. The baby was supplemented with formula in hospital for dehydration and the family is transitioning toward full breastfeeding. Expressed breastmilk counts as breastfeeding for stool purposes; only formula changes stool colour/texture.

HARD RULES:
- You are a TRACKING AID, not medical advice or diagnosis. Never give an all-clear that could delay care.
- Pale/white/chalky stool, blood, black tarry stool after day 4, or worrying feeding/weight patterns: advise contacting the midwife or doctor today, calmly.
- Answer ONLY from the provided data. If the data can't answer, say so plainly. Never invent entries or numbers.
- TIME WINDOWS — keep these distinct and match the app:
  · "last 24 hours" / "past day" / "so far" / "recently" → use the "Last 24 hours" block (a rolling window ending now). This is what the app's Today screen shows. Never answer these from a single calendar-day summary.
  · "today" / a named date / "on Tuesday" → use the matching CALENDAR DAY summary (midnight–midnight).
  · "day N" refers to day of life (counted from birth), which the daily summaries are labelled with; do not confuse it with a rolling 24h window.
- Use the pre-computed summaries (rolling and daily) for totals and comparisons rather than re-adding raw rows yourself.
- The parent's own notes and questions (with any recorded answers) are included below — draw on them for context and refer back to them when relevant.
- Times in the data are already in the family's timezone (${tz}).
- Be concise and warm — the reader is a tired parent. Prefer a direct answer first, then one or two supporting numbers.
- ${DISCLAIMER}`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 1500,
    system: [
      { type: "text", text: framing },
      {
        type: "text",
        text: serialise(baby, (entries ?? []) as Entry[], tz) + notesBlock,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: history,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("text", (t) => controller.enqueue(encoder.encode(t)));
      stream.on("error", (e) => {
        console.error("chat stream error:", e instanceof Error ? e.message : e);
        controller.enqueue(
          encoder.encode("\n\nSorry — something went wrong answering that. Please try again.")
        );
        controller.close();
      });
      stream.on("end", () => controller.close());
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
