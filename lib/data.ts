import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "./supabase/server";
import type { Baby, Entry, MemberRole } from "./types";

export interface BabyContext {
  baby: Baby;
  role: MemberRole;
  canEdit: boolean;
  isOwner: boolean;
  babies: Array<{ baby: Baby; role: MemberRole }>;
  userId: string;
}

const ACTIVE_BABY_COOKIE = "hearth_active_baby";

/**
 * Resolve the signed-in user and their active baby (cookie-selected, else
 * first). Redirects to /login or /onboarding when either is missing.
 */
export const getBabyContext = cache(async (): Promise<BabyContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("baby_members")
    .select("role, baby:babies(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const babies = (memberships ?? [])
    .filter((m) => m.baby)
    .map((m) => ({
      baby: m.baby as unknown as Baby,
      role: m.role as MemberRole,
    }));

  if (babies.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_BABY_COOKIE)?.value;
  const active = babies.find((b) => b.baby.id === activeId) ?? babies[0];

  return {
    baby: active.baby,
    role: active.role,
    canEdit: active.role === "owner" || active.role === "caregiver",
    isOwner: active.role === "owner",
    babies,
    userId: user.id,
  };
});

/** All entries for a baby, newest first. Unbounded — this grows with the
 *  baby's whole history, so it belongs only on routes that genuinely look at
 *  everything (dashboard charts, report, CSV export), never the cold-start
 *  path. Memoised per request. */
export const getEntries = cache(async (babyId: string): Promise<Entry[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entries")
    .select("*")
    .eq("baby_id", babyId)
    .order("occurred_at", { ascending: false });
  return (data ?? []) as Entry[];
});

/** The hot-path window. 7 days is the longest lookback anything on the
 *  cold-start path needs (Today's recent-doses card); everything else there
 *  works on the last 24h or a handful of recent gaps. Fixed (rather than a
 *  parameter) so the layout and page share one memoised query per request. */
const RECENT_DAYS = 7;

/** Entries from the last {@link RECENT_DAYS} days, newest first. Memoised per
 *  request so the layout (LogModal) and the page don't fetch twice. */
export const getRecentEntries = cache(async (babyId: string): Promise<Entry[]> => {
  const supabase = await createClient();
  const since = new Date(
    Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data } = await supabase
    .from("entries")
    .select("*")
    .eq("baby_id", babyId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false });
  return (data ?? []) as Entry[];
});

/** The single most recent weight, however long ago — Today always shows it. */
export const getLatestWeight = cache(
  async (babyId: string): Promise<Entry | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("entries")
      .select("*")
      .eq("baby_id", babyId)
      .eq("type", "weight")
      .not("weight_g", "is", null)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as Entry | null) ?? null;
  }
);

/** Medication courses still running (started, not yet ended) — they can start
 *  long before any recent window, so they need their own query. */
export const getActiveMedCourses = cache(
  async (babyId: string): Promise<Entry[]> => {
    const supabase = await createClient();
    const nowISO = new Date().toISOString();
    const { data } = await supabase
      .from("entries")
      .select("*")
      .eq("baby_id", babyId)
      .eq("type", "medication")
      .or("med_kind.is.null,med_kind.neq.dose")
      .lte("occurred_at", nowISO)
      .or(`ended_at.is.null,ended_at.gte.${nowISO}`)
      .order("occurred_at", { ascending: false });
    return (data ?? []) as Entry[];
  }
);

/** Entries in a half-open window [since, before), newest first. Uncached —
 *  History's pagination calls it with a moving cursor. */
export async function getEntriesRange(
  babyId: string,
  opts: { since?: string; before?: string }
): Promise<Entry[]> {
  const supabase = await createClient();
  let query = supabase.from("entries").select("*").eq("baby_id", babyId);
  if (opts.since) query = query.gte("occurred_at", opts.since);
  if (opts.before) query = query.lt("occurred_at", opts.before);
  const { data } = await query.order("occurred_at", { ascending: false });
  return (data ?? []) as Entry[];
}

/** History loads this many days per window (initial page and each "older"). */
export const HISTORY_WINDOW_DAYS = 30;

/** Short-TTL signed URLs for the photo thumbnails among `entries` (private
 *  bucket). Keyed by storage path. */
export async function signPhotoUrls(
  entries: Entry[]
): Promise<Record<string, string>> {
  const paths = entries.filter((e) => e.photo_path).map((e) => e.photo_path!);
  if (paths.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("nappy-photos")
    .createSignedUrls(paths, 600);
  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) urls[item.path] = item.signedUrl;
  }
  return urls;
}

/** Whether anything was logged before the given time (drives "load older"). */
export async function hasEntriesBefore(
  babyId: string,
  beforeISO: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entries")
    .select("id")
    .eq("baby_id", babyId)
    .lt("occurred_at", beforeISO)
    .limit(1);
  return (data ?? []).length > 0;
}

export { ACTIVE_BABY_COOKIE };
