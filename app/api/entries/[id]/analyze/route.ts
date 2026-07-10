import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  buildAnalysisPrompt,
  runPhotoAnalysis,
  type MediaType,
} from "@/lib/analysis";
import { NAPPY_WET_THRESHOLD_G, STOOL_G_BY_AMOUNT, nappyOutputG } from "@/lib/clinical";
import type { AiAnalysis, Baby, Entry } from "@/lib/types";

export const runtime = "nodejs";

// Re-analyses an already-saved entry from its stored photo. Used when a photo
// is added to an existing entry outside the on-upload flow.

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
  if (baby.membership_tier !== "advanced") {
    return NextResponse.json(
      { error: "AI photo labelling is part of the Advanced membership." },
      { status: 403 }
    );
  }

  // Feeds (for the mix window) and the mother's medications (for context).
  const { data: contextEntries } = await supabase
    .from("entries")
    .select("*")
    .eq("baby_id", entry.baby_id)
    .in("type", ["feed", "medication"]);
  const ctxRows = (contextEntries ?? []) as Entry[];

  // 2. Read the private photo with the service role.
  const service = createServiceClient();
  const { data: file, error: fileError } = await service.storage
    .from("nappy-photos")
    .download(entry.photo_path);
  if (fileError || !file) {
    return NextResponse.json({ error: "Could not read the photo" }, { status: 500 });
  }
  const imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mediaType = (file.type || "image/jpeg") as MediaType;

  // 3. Analyse.
  let ai: AiAnalysis;
  try {
    ai = await runPhotoAnalysis({
      imageBase64,
      mediaType,
      prompt: buildAnalysisPrompt({
        baby: baby as Baby,
        occurredAt: entry.occurred_at,
        feedEntries: ctxRows.filter((e) => e.type === "feed"),
        medEntries: ctxRows.filter((e) => e.type === "medication"),
        nappyWeightG: entry.nappy_weight_g,
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Analysis failed" },
      { status: 502 }
    );
  }

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
