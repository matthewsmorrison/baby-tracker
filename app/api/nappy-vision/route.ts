import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { BEA_MODEL } from "@/lib/aiContext";
import { ACTIVE_BABY_COOKIE } from "@/lib/data";
import type { Baby } from "@/lib/types";

// Vision pre-fill for the nappy form: classify a nappy photo into
// wet/dirty/stool colour. The suggestion is stored on the entry alongside
// what the parent actually saves (ai_prefill), so corrections become
// training/eval data.

const STOOL_COLOURS = [
  "meconium",
  "transitional",
  "yellow",
  "tan",
  "brown",
  "green",
  "pale",
  "blood",
] as const;

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
// ~6 MB of base64 — the client sends the same compressed jpeg it uploads.
const MAX_B64_CHARS = 8_000_000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { image?: string; media_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const mediaType = MEDIA_TYPES.find((m) => m === body.media_type) ?? "image/jpeg";
  const image =
    typeof body.image === "string"
      ? body.image.replace(/^data:image\/\w+;base64,/, "")
      : "";
  if (!image || image.length > MAX_B64_CHARS) {
    return NextResponse.json({ error: "Bad image" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_BABY_COOKIE)?.value;
  const { data: memberships } = await supabase
    .from("baby_members")
    .select("role, baby:babies(*)")
    .eq("user_id", user.id)
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
      { error: "Photo analysis is part of the Advanced membership." },
      { status: 403 }
    );
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: BEA_MODEL,
    max_tokens: 300,
    // Mechanical classification with forced tool choice — thinking off so the
    // budget goes to the structured output.
    thinking: { type: "disabled" },
    system: `You classify photos of used baby nappies for a newborn tracking app. Report only what is visible:
- wet: urine present (a wetness indicator line that has changed colour counts; if genuinely unjudgeable, null)
- dirty: stool present
- stool_colour: the closest of ${STOOL_COLOURS.join("|")} (only when dirty; "pale" = pale/white/chalky, "blood" = any visible blood)
- confidence: low|medium|high for the overall read
- observation: one short factual sentence about what you see (no advice)
If the photo is not a nappy, set everything null/low and say so in observation. This is a logging aid, not a medical assessment.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: image },
          },
          { type: "text", text: "Classify this nappy photo." },
        ],
      },
    ],
    tools: [
      {
        name: "nappy_assessment",
        description: "Report the nappy classification.",
        input_schema: {
          type: "object" as const,
          properties: {
            wet: { type: ["boolean", "null"] },
            dirty: { type: ["boolean", "null"] },
            stool_colour: {
              type: ["string", "null"],
              enum: [...STOOL_COLOURS, null],
            },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
            observation: { type: "string" },
          },
          required: ["wet", "dirty", "confidence", "observation"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "nappy_assessment" },
  });

  const toolUse = msg.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use"
  );
  const raw = (toolUse?.input ?? {}) as Record<string, unknown>;
  const colour = STOOL_COLOURS.find((c) => c === raw.stool_colour) ?? null;
  return NextResponse.json({
    wet: typeof raw.wet === "boolean" ? raw.wet : null,
    dirty: typeof raw.dirty === "boolean" ? raw.dirty : null,
    stool_colour: raw.dirty === true ? colour : null,
    confidence: ["low", "medium", "high"].includes(String(raw.confidence))
      ? (raw.confidence as "low" | "medium" | "high")
      : "low",
    observation:
      typeof raw.observation === "string" ? raw.observation.slice(0, 300) : "",
  });
}
