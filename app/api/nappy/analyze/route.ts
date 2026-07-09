import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ANALYSIS_MODEL,
  buildAnalysisPrompt,
  runPhotoAnalysis,
  type MediaType,
} from "@/lib/analysis";
import { STOOL_G_BY_AMOUNT, nappyOutputG } from "@/lib/clinical";
import type { Baby, Entry } from "@/lib/types";

export const runtime = "nodejs";

const MEDIA_TYPES: MediaType[] = ["image/jpeg", "image/png", "image/webp"];

/**
 * Labels a nappy photo the moment it's chosen — before the entry is saved.
 * Takes the image inline (base64) plus the baby + the intended time, so the
 * analysis can run immediately and its result is stored with the entry on
 * save. Advanced membership only. Does NOT write to the database.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: {
    babyId?: string;
    occurredAt?: string;
    imageBase64?: string;
    mediaType?: string;
    nappyWeightG?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const { babyId, occurredAt, imageBase64 } = body;
  const mediaType = (
    MEDIA_TYPES.includes(body.mediaType as MediaType)
      ? body.mediaType
      : "image/jpeg"
  ) as MediaType;
  if (!babyId || !occurredAt || !imageBase64) {
    return NextResponse.json({ error: "Missing photo or context" }, { status: 400 });
  }

  // RLS + write permission: only a carer of this baby may analyse for it.
  const { data: canEdit } = await supabase.rpc("can_edit_baby", { bid: babyId });
  if (!canEdit) {
    return NextResponse.json({ error: "Read-only access" }, { status: 403 });
  }

  const { data: baby } = await supabase
    .from("babies")
    .select("*")
    .eq("id", babyId)
    .single();
  if (!baby) {
    return NextResponse.json({ error: "Baby not found" }, { status: 404 });
  }
  if ((baby as Baby).membership_tier !== "advanced") {
    return NextResponse.json(
      { error: "AI photo labelling is part of the Advanced membership." },
      { status: 403 }
    );
  }

  const { data: feedEntries } = await supabase
    .from("entries")
    .select("*")
    .eq("baby_id", babyId)
    .eq("type", "feed");

  const prompt = buildAnalysisPrompt({
    baby: baby as Baby,
    occurredAt,
    feedEntries: (feedEntries ?? []) as Entry[],
    nappyWeightG: body.nappyWeightG ?? null,
  });

  let ai;
  try {
    ai = await runPhotoAnalysis({ imageBase64, mediaType, prompt });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Analysis failed", model: ANALYSIS_MODEL },
      { status: 502 }
    );
  }

  // Urine estimate when the nappy was weighed (contents minus visible stool).
  const outG = nappyOutputG(body.nappyWeightG ?? null, (baby as Baby).nappy_base_weight_g);
  if (outG !== null) {
    const stoolG = STOOL_G_BY_AMOUNT[ai.stoolAmount ?? "none"] ?? 0;
    ai.estimatedUrineMl = Math.max(0, outG - stoolG);
  }

  return NextResponse.json({ ai });
}
