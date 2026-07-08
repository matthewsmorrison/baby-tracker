import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendToUsers } from "@/lib/push";
import { dayOfLife, expectedNappies } from "@/lib/clinical";
import type { Baby, Entry } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
// A feed-due nudge fires once the feed is due and only within this window
// after, so a late cron run doesn't ping about a long-passed due time.
const FEED_DUE_WINDOW_MS = 45 * 60 * 1000;

/**
 * Scheduled alert sender (called by the notify GitHub Action). Guarded by a
 * shared secret. For each baby, sends at most one of each alert kind, deduped
 * via baby_alert_log so repeat runs don't spam.
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const svc = createServiceClient();
  const now = Date.now();
  const results = { feedDue: 0, lowNappies: 0 };

  // Only bother with babies that have at least one subscribed member.
  const { data: subs } = await svc
    .from("push_subscriptions")
    .select("user_id");
  const subscribedUsers = new Set((subs ?? []).map((s) => s.user_id));
  if (subscribedUsers.size === 0) return NextResponse.json({ ok: true, results });

  const { data: memberships } = await svc
    .from("baby_members")
    .select("baby_id, user_id, role");
  // baby -> the subscribed carers who should receive its alerts
  const babyRecipients = new Map<string, string[]>();
  for (const m of memberships ?? []) {
    if (m.role === "viewer") continue; // carers only
    if (!subscribedUsers.has(m.user_id)) continue;
    const arr = babyRecipients.get(m.baby_id) ?? [];
    arr.push(m.user_id);
    babyRecipients.set(m.baby_id, arr);
  }
  if (babyRecipients.size === 0) return NextResponse.json({ ok: true, results });

  const babyIds = [...babyRecipients.keys()];
  const { data: babies } = await svc.from("babies").select("*").in("id", babyIds);

  async function alreadySent(babyId: string, kind: string, key: string) {
    const { data } = await svc
      .from("baby_alert_log")
      .select("dedupe_key")
      .eq("baby_id", babyId)
      .eq("kind", kind)
      .eq("dedupe_key", key)
      .maybeSingle();
    return !!data;
  }
  async function markSent(babyId: string, kind: string, key: string) {
    await svc
      .from("baby_alert_log")
      .insert({ baby_id: babyId, kind, dedupe_key: key });
  }

  for (const baby of (babies ?? []) as Baby[]) {
    const recipients = babyRecipients.get(baby.id)!;

    // Entries from the last ~26h — enough for the feed-due and 24h nappy checks.
    const { data: recent } = await svc
      .from("entries")
      .select("*")
      .eq("baby_id", baby.id)
      .gte("occurred_at", new Date(now - 26 * 60 * 60 * 1000).toISOString())
      .order("occurred_at", { ascending: false });
    const entries = (recent ?? []) as Entry[];

    // --- Feed due -----------------------------------------------------------
    if (baby.feed_interval_min) {
      const lastFeed = entries.find((e) => e.type === "feed");
      if (lastFeed) {
        const due = new Date(lastFeed.occurred_at).getTime() +
          baby.feed_interval_min * 60_000;
        if (now >= due && now - due <= FEED_DUE_WINDOW_MS) {
          const key = lastFeed.id; // one nudge per feed becoming due
          if (!(await alreadySent(baby.id, "feed_due", key))) {
            const n = await sendToUsers(recipients, {
              title: `${baby.name} — feed due`,
              body: `It's been about ${Math.round(baby.feed_interval_min / 60 * 10) / 10}h since the last feed. A nudge, not a rule — feed on cues.`,
              url: "/today",
              tag: `feed-due-${baby.id}`,
            });
            if (n > 0) {
              await markSent(baby.id, "feed_due", key);
              results.feedDue += 1;
            }
          }
        }
      }
    }

    // --- Not enough nappies (once per UTC day) ------------------------------
    const day = dayOfLife(baby.birth_at, new Date(now));
    const exp = expectedNappies(day);
    const nappies24 = entries.filter(
      (e) => e.type === "nappy" && now - new Date(e.occurred_at).getTime() <= DAY_MS
    );
    const total24 = nappies24.length;
    const dirty24 = nappies24.filter((e) => e.dirty).length;
    // Only nudge later in the day so an early-morning count isn't alarming.
    const hourUTC = new Date(now).getUTCHours();
    const short = total24 < exp.total || dirty24 < exp.minDirty;
    if (hourUTC >= 18 && short) {
      const key = new Date(now).toISOString().slice(0, 10); // per day
      if (!(await alreadySent(baby.id, "low_nappies", key))) {
        const n = await sendToUsers(recipients, {
          title: `${baby.name} — keep an eye on nappies`,
          body: `${total24} nappies so far today (${dirty24} mixed). Day ${day} usually sees about ${exp.total}, at least ${exp.minDirty} with poo. Worth watching; contact your midwife if you're concerned.`,
          url: "/today",
          tag: `low-nappies-${baby.id}`,
        });
        if (n > 0) {
          await markSent(baby.id, "low_nappies", key);
          results.lowNappies += 1;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, results });
}
