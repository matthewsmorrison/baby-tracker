import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  NAPPY_WET_THRESHOLD_G,
  STOOL_G_BY_AMOUNT,
  dayOfLife,
  expectedColour,
  feedsBefore,
  nappyOutputG,
  summariseFeeds,
} from "@/lib/clinical";
import type { AiAnalysis, Baby, Entry } from "@/lib/types";

// Server-only: reads the private photo with the service role and calls the
// Anthropic API. The key never reaches the client.

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["visibleContents", "colour", "colourKey", "consistency", "stoolAmount"],
  properties: {
    visibleContents: { type: "string", enum: ["poo", "wee", "both", "unclear"] },
    colour: { type: "string" },
    colourKey: {
      type: "string",
      enum: [
        "meconium",
        "transitional",
        "yellow",
        "tan",
        "brown",
        "green",
        "pale",
        "blood",
        "unclear",
      ],
      description:
        "The single best-matching stool colour category, or 'unclear' if no stool is clearly visible",
    },
    consistency: { type: "string" },
    stoolAmount: {
      type: "string",
      enum: ["none", "smear", "small", "medium", "large"],
      description:
        "How much stool is visible: none, a smear, small (~1-2 tbsp), medium (~3-5 tbsp), large (covers most of the nappy)",
    },
  },
} as const;

function buildPrompt(baby: Baby, entry: Entry, entries: Entry[]): string {
  const day = dayOfLife(baby.birth_at, entry.occurred_at);
  const feeds = summariseFeeds(feedsBefore(entries, entry.occurred_at));
  const expected = expectedColour(day, feeds.mix);

  const feedSummary =
    feeds.sessions === 0
      ? "No feeds logged in the 24h before this nappy."
      : `In the 24h before this nappy: ${feeds.breastCount} breastfeeds (${feeds.breastMin} min total), ${feeds.expressedMl} ml expressed breastmilk, ${feeds.formulaMl} ml formula. Feeding mix: ${feeds.mix}.`;

  const output = nappyOutputG(entry.nappy_weight_g, baby.nappy_base_weight_g);
  const weightContext =
    output !== null
      ? `\n- The used nappy was weighed: ${entry.nappy_weight_g} g vs a ${baby.nappy_base_weight_g} g dry nappy — about ${output} g of contents (1 g ≈ 1 ml). ${output >= NAPPY_WET_THRESHOLD_G ? "So the nappy definitely contains output, whatever the photo shows." : "Very little output by weight."}`
      : "";

  return `You are helping parents of a newborn track nappy contents. This is a TRACKING AID, not medical advice or diagnosis.

Context for THIS baby:
- Day of life at the time of this nappy: day ${day} (computed from the entry's own date, which may be in the past)
- Birth weight: ${baby.birth_weight_g} g
- The baby was supplemented with formula in hospital for dehydration and the family is transitioning toward full breastfeeding.
- ${feedSummary}${weightContext}

Stool type depends on feeding, so judge against the matching pattern:
- Breastfed / expressed breastmilk (EBM counts as breastfed): mustard-yellow, seedy, quite runny.
- Formula: tan to brown, pasty (peanut-butter texture), stronger smelling.
- Mixed feeding: anywhere in between; stools trending tan → yellow-seedy over days is a GOOD sign the transition to breastfeeding is progressing — note it when you see it.
- Days 1-2: meconium (black-green, tarry) is normal regardless of feeding. Days 3-4: transitional green-brown.
- Expected for this baby today: ${expected}

Label the photo of the nappy. Your job is LABELLING ONLY — colour, texture and amounts. Do not give advice, verdicts, reassurance or warnings; the app derives any guidance from your labels, and the parents can overwrite every label.

For stoolAmount, estimate how much stool is visible: none, smear, small (~1-2 tablespoons), medium (~3-5 tablespoons), or large (covers most of the nappy). If the nappy was weighed (context above), sanity-check your estimate against the total contents.

For colourKey, classify the stool into exactly ONE of:
- meconium: black to very dark green, tarry/sticky
- transitional: green-brown, changing stool of days 3-4
- yellow: mustard yellow, typical breastfed
- tan: tan/light brown, typical formula or mixed feeding
- brown: mid-to-dark brown, typical formula
- green: distinctly green
- pale: pale, white, chalky, clay or grey (RED FLAG)
- blood: visible red blood or black tarry stool after day 4 (RED FLAG)
- unclear: no stool clearly visible in the photo

LABELLING RULES:
- Choose "pale" or "blood" whenever they genuinely might apply — under-labelling those could delay care. When torn between pale and another colour, choose pale.
- Do not stretch: normal formula-type tan/brown pasty stool is tan or brown, not a concern colour.
- If the image is unclear or shows no stool, use colourKey "unclear" and stoolAmount "none".`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Auth + permission: the user session client is subject to RLS, so this
  // read only succeeds for members; then confirm write permission.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: entry } = await supabase
    .from("entries")
    .select("*")
    .eq("id", id)
    .single();
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const { data: canEdit } = await supabase.rpc("can_edit_baby", {
    bid: entry.baby_id,
  });
  if (!canEdit) {
    return NextResponse.json({ error: "Read-only access" }, { status: 403 });
  }
  if (!entry.photo_path) {
    return NextResponse.json({ error: "No photo on this entry" }, { status: 400 });
  }

  const { data: baby } = await supabase
    .from("babies")
    .select("*")
    .eq("id", entry.baby_id)
    .single();
  if (!baby) {
    return NextResponse.json({ error: "Baby not found" }, { status: 404 });
  }

  // Feeds for the mix window (24h before the entry's occurred_at).
  const { data: feedEntries } = await supabase
    .from("entries")
    .select("*")
    .eq("baby_id", entry.baby_id)
    .eq("type", "feed");

  // 2. Read the private photo with the service role.
  const service = createServiceClient();
  const { data: file, error: fileError } = await service.storage
    .from("nappy-photos")
    .download(entry.photo_path);
  if (fileError || !file) {
    return NextResponse.json({ error: "Could not read the photo" }, { status: 500 });
  }
  const imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mediaType = (file.type || "image/jpeg") as
    | "image/jpeg"
    | "image/png"
    | "image/webp";

  // 3. Call the Anthropic API with structured output.
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: {
        format: {
          type: "json_schema",
          schema: ANALYSIS_SCHEMA,
        },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: buildPrompt(
                baby as Baby,
                entry as Entry,
                (feedEntries ?? []) as Entry[]
              ),
            },
          ],
        },
      ],
    });
  } catch (e) {
    console.error("Anthropic analysis failed:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Analysis is unavailable right now — the entry was saved." },
      { status: 502 }
    );
  }

  if (response.stop_reason === "refusal" || response.content.length === 0) {
    return NextResponse.json(
      { error: "The photo couldn't be analysed — the entry was saved." },
      { status: 502 }
    );
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json({ error: "Unexpected model response" }, { status: 502 });
  }

  let ai: AiAnalysis;
  try {
    ai = JSON.parse(textBlock.text) as AiAnalysis;
  } catch {
    return NextResponse.json({ error: "Could not parse analysis" }, { status: 502 });
  }

  ai.analysedAt = new Date().toISOString();
  ai.model = MODEL;

  // Urine estimate: weighed contents minus the stool the photo shows.
  {
    const outG = nappyOutputG(entry.nappy_weight_g, baby.nappy_base_weight_g);
    if (outG !== null) {
      const stoolG = STOOL_G_BY_AMOUNT[ai.stoolAmount ?? "none"] ?? 0;
      ai.estimatedUrineMl = Math.max(0, outG - stoolG);
    }
  }

  // 4. Persist. The AI labels the stool colour, but a parent's manual
  // correction always wins: only write colourKey when the entry has no colour
  // yet, or when the current colour is the AI's own previous label.
  const VALID_COLOURS = [
    "meconium",
    "transitional",
    "yellow",
    "tan",
    "brown",
    "green",
    "pale",
    "blood",
  ];
  const prevAiColour = (entry.ai as AiAnalysis | null)?.colourKey;
  const aiColour =
    ai.colourKey && VALID_COLOURS.includes(ai.colourKey) ? ai.colourKey : null;

  const updates: { ai: AiAnalysis; stool_colour?: string; dirty?: boolean } = {
    ai,
  };
  // The AI fills in wet/dirty only on the FIRST analysis of an entry. Once
  // an analysis has run, the parents have seen the result — a false value
  // after that is a deliberate correction and is never overwritten.
  const firstAnalysis = !entry.ai;
  const parentOverrodeColour =
    entry.stool_colour && entry.stool_colour !== prevAiColour;
  const parentSaysNotDirty = !entry.dirty && !firstAnalysis;

  if (aiColour && !parentOverrodeColour && !parentSaysNotDirty) {
    updates.stool_colour = aiColour;
    if (!entry.dirty) updates.dirty = true; // stool visible in the photo
  }

  // Weight-based wetness: the scales beat the photo for "wet" — but only
  // the first time; an unticked "wet" after analysis is the parent's call.
  const outputG = nappyOutputG(entry.nappy_weight_g, baby.nappy_base_weight_g);
  const wetUpdates = updates as typeof updates & { wet?: boolean };
  if (
    firstAnalysis &&
    outputG !== null &&
    outputG >= NAPPY_WET_THRESHOLD_G &&
    !entry.wet
  ) {
    wetUpdates.wet = true;
  }

  // User client — RLS re-checks write permission.
  const { error: updateError } = await supabase
    .from("entries")
    .update(updates)
    .eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ai,
    stool_colour: updates.stool_colour ?? entry.stool_colour ?? null,
    dirty: updates.dirty ?? entry.dirty,
    wet: wetUpdates.wet ?? entry.wet,
  });
}
