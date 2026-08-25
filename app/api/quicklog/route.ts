import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { getRouteAuth } from "@/lib/supabase/route";
import { BEA_MODEL } from "@/lib/aiContext";
import { ACTIVE_BABY_COOKIE } from "@/lib/data";
import { RATE_LIMITED, rateLimit } from "@/lib/rateLimit";
import type { Baby } from "@/lib/types";

// Natural-language quick-log: "fed 15 min left, wet nappy, down at 7:40" →
// structured draft entries. The server only PARSES — the client shows the
// drafts for confirmation and inserts them itself (through RLS), exactly like
// the manual forms do.

const STOOL_COLOURS = [
  "meconium",
  "transitional",
  "yellow",
  "tan",
  "brown",
  "green",
  "pale",
  "blood",
];

const ENTRY_SCHEMA = {
  type: "object" as const,
  properties: {
    entries: {
      type: "array",
      description: "One item per distinct event described.",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [
              "feed",
              "nappy",
              "sleep",
              "weight",
              "pump",
              "carer_sleep",
              "temperature",
              "milestone",
            ],
          },
          occurred_at: {
            type: "string",
            description:
              "ISO 8601 with the family's UTC offset. The event start.",
          },
          ended_at: {
            type: "string",
            description: "ISO 8601 end, for sleeps/feeds/pumps with one.",
          },
          left_min: { type: "integer", description: "feed: left-breast minutes" },
          right_min: { type: "integer", description: "feed: right-breast minutes" },
          expressed_ml: {
            type: "integer",
            description: "feed: expressed-milk ml; pump: ml collected",
          },
          formula_ml: { type: "integer", description: "feed: formula ml" },
          spit_up: { type: "boolean", description: "feed: brought milk back up" },
          post_feed_mood: {
            type: "string",
            enum: ["settled", "fussy", "crying"],
          },
          wet: { type: "boolean", description: "nappy: wee present" },
          dirty: { type: "boolean", description: "nappy: poo present" },
          stool_colour: { type: "string", enum: STOOL_COLOURS },
          nappy_weight_g: { type: "integer", description: "nappy: used weight in g" },
          sleep_location: {
            type: "string",
            enum: ["cot", "arms", "pram", "car_seat", "next_to_me", "other"],
          },
          settle_method: {
            type: "string",
            enum: ["self", "fed", "rocked", "dummy", "other"],
          },
          weight_g: { type: "integer", description: "weight in grams" },
          length_mm: { type: "integer", description: "length in millimetres" },
          head_circ_mm: {
            type: "integer",
            description: "head circumference in millimetres",
          },
          temp_c: { type: "number", description: "temperature in °C" },
          milestone_label: {
            type: "string",
            description: 'milestone: short label, e.g. "First social smile"',
          },
          note: {
            type: "string",
            description: "anything said that doesn't fit a field, verbatim-ish",
          },
        },
        required: ["type", "occurred_at"],
      },
    },
    unclear: {
      type: "string",
      description:
        "Anything you could NOT confidently turn into an entry, briefly — or omit.",
    },
  },
  required: ["entries"],
};

export async function POST(request: Request) {
  // Cookie session (web) or bearer token (native iOS) — RLS either way.
  const auth = await getRouteAuth(request);
  if (!auth) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { supabase, userId } = auth;
  if (!rateLimit(`quicklog:${userId}`, 30, 10 * 60_000)) {
    return NextResponse.json(RATE_LIMITED, { status: 429 });
  }

  let body: { text?: string; tz?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 2000) : "";
  if (!text) return NextResponse.json({ error: "Nothing to parse" }, { status: 400 });
  const tz = typeof body.tz === "string" && body.tz.length < 64 ? body.tz : "UTC";

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_BABY_COOKIE)?.value;
  const { data: memberships } = await supabase
    .from("baby_members")
    .select("role, baby:babies(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const babies = (memberships ?? [])
    .map((m) => ({ baby: m.baby as unknown as Baby, role: m.role as string }))
    .filter((m) => m.baby);
  const active = babies.find((b) => b.baby.id === activeId) ?? babies[0];
  if (!active) return NextResponse.json({ error: "No baby" }, { status: 404 });
  if (active.role === "viewer") {
    return NextResponse.json({ error: "Viewers can't log entries." }, { status: 403 });
  }
  if (active.baby.membership_tier !== "advanced") {
    return NextResponse.json(
      { error: "Quick log is part of the Advanced membership." },
      { status: 403 }
    );
  }

  const now = new Date();
  const nowLocal = now.toLocaleString("en-GB", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "longOffset",
  });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: BEA_MODEL,
    max_tokens: 1200,
    // Mechanical extraction with forced tool choice — thinking off so the
    // budget goes to the structured output.
    thinking: { type: "disabled" },
    system: `You turn a tired parent's free-text description of newborn events into structured tracker entries for ${active.baby.name} (born ${new Date(active.baby.birth_at).toISOString()}).

Right now it is ${nowLocal} (family timezone: ${tz}; current UTC instant: ${now.toISOString()}).

Rules:
- Split the text into separate entries per event. "Fed 10 min each side then a dirty nappy" = one feed (left_min 10, right_min 10) + one nappy (dirty true, wet true — a poo nappy is assumed to have wee too).
- Times: resolve relative ("an hour ago", "at 3am") against the current local time; a named clock time means the MOST RECENT such time, never the future. No time mentioned → the event just happened (a few minutes ago). Output occurred_at/ended_at as ISO 8601 WITH the family's UTC offset.
- Units: minutes for breast, ml for bottles/pumping, grams for weight (convert "3.6kg"→3600), mm for length/head ("52cm"→520), °C for temperature.
- A plain "wet nappy" → wet true, dirty false. "Dirty"/"poo" → dirty true, wet true.
- Only include fields the parent actually stated or that follow directly; put anything else they said in note. Never invent amounts.
- If part of the text can't be confidently parsed, leave it out of entries and describe it in "unclear".`,
    messages: [{ role: "user", content: text }],
    tools: [
      {
        name: "log_entries",
        description: "Report the structured entries parsed from the text.",
        input_schema: ENTRY_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "log_entries" },
  });

  const toolUse = msg.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use"
  );
  const input = (toolUse?.input ?? { entries: [] }) as {
    entries?: Array<Record<string, unknown>>;
    unclear?: string;
  };

  // Server-side sanity pass: keep only known fields, parseable times within
  // (birth − 1 day, now + 10 min), and sane numbers.
  const minMs = new Date(active.baby.birth_at).getTime() - 24 * 60 * 60 * 1000;
  const maxMs = now.getTime() + 10 * 60 * 1000;
  const int = (v: unknown, lo: number, hi: number) => {
    const n = typeof v === "number" ? Math.round(v) : NaN;
    return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
  };
  const iso = (v: unknown) => {
    if (typeof v !== "string") return null;
    const t = new Date(v).getTime();
    return Number.isFinite(t) && t >= minMs && t <= maxMs
      ? new Date(t).toISOString()
      : null;
  };
  const oneOf = <T extends string>(v: unknown, opts: readonly T[]): T | null =>
    typeof v === "string" && (opts as readonly string[]).includes(v)
      ? (v as T)
      : null;

  const entries = (input.entries ?? [])
    .map((e) => {
      const type = oneOf(e.type, [
        "feed",
        "nappy",
        "sleep",
        "weight",
        "pump",
        "carer_sleep",
        "temperature",
        "milestone",
      ] as const);
      const occurred_at = iso(e.occurred_at);
      if (!type || !occurred_at) return null;
      const ended_at = iso(e.ended_at);
      const out: Record<string, unknown> = { type, occurred_at };
      if (ended_at && new Date(ended_at) > new Date(occurred_at))
        out.ended_at = ended_at;
      if (type === "feed") {
        out.left_min = int(e.left_min, 1, 120);
        out.right_min = int(e.right_min, 1, 120);
        out.expressed_ml = int(e.expressed_ml, 1, 500);
        out.formula_ml = int(e.formula_ml, 1, 500);
        out.spit_up = e.spit_up === true ? true : null;
        out.post_feed_mood = oneOf(e.post_feed_mood, [
          "settled",
          "fussy",
          "crying",
        ] as const);
        if (!out.left_min && !out.right_min && !out.expressed_ml && !out.formula_ml)
          return null;
      }
      if (type === "nappy") {
        out.wet = e.wet === true;
        out.dirty = e.dirty === true;
        if (out.dirty) out.wet = true;
        out.stool_colour = out.dirty ? oneOf(e.stool_colour, STOOL_COLOURS) : null;
        out.nappy_weight_g = int(e.nappy_weight_g, 1, 500);
        if (!out.wet && !out.dirty) return null;
      }
      if (type === "sleep") {
        out.sleep_location = oneOf(e.sleep_location, [
          "cot",
          "arms",
          "pram",
          "car_seat",
          "next_to_me",
          "other",
        ] as const);
        out.settle_method = oneOf(e.settle_method, [
          "self",
          "fed",
          "rocked",
          "dummy",
          "other",
        ] as const);
      }
      if (type === "weight") {
        out.weight_g = int(e.weight_g, 500, 10000);
        out.length_mm = int(e.length_mm, 300, 1000);
        out.head_circ_mm = int(e.head_circ_mm, 250, 600);
        if (!out.weight_g && !out.length_mm && !out.head_circ_mm) return null;
      }
      if (type === "pump") out.expressed_ml = int(e.expressed_ml, 1, 1000);
      if (type === "temperature") {
        const t =
          typeof e.temp_c === "number" && e.temp_c >= 30 && e.temp_c <= 43
            ? Math.round(e.temp_c * 10) / 10
            : null;
        if (!t) return null;
        out.temp_c = t;
      }
      if (type === "milestone") {
        const label =
          typeof e.milestone_label === "string"
            ? e.milestone_label.trim().slice(0, 120)
            : "";
        if (!label) return null;
        out.milestone_label = label;
      }
      if (typeof e.note === "string" && e.note.trim())
        out.note = e.note.trim().slice(0, 500);
      return out;
    })
    .filter(Boolean);

  return NextResponse.json({
    entries,
    unclear: typeof input.unclear === "string" ? input.unclear : null,
  });
}
