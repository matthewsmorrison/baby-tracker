import { getBabyContext, getEntries } from "@/lib/data";
import {
  DISCLAIMER,
  EXPECTED_FEEDS,
  RED_FLAGS,
  STOOL_COLOURS,
  dayOfLife,
  expectedColour,
  expectedColourKey,
  expectedWeightBand,
  formatKg,
  mixLabel,
  summariseFeeds,
  weightStatus,
} from "@/lib/clinical";
import { feedGaps, median } from "@/lib/entryDisplay";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { KpiCard } from "@/components/output/KpiCard";
import { NappyQuota } from "@/components/output/NappyQuota";
import { NextFeedCard } from "@/components/output/NextFeedCard";
import { SkyArc } from "@/components/output/SkyArc";
import { AlertTriangle } from "lucide-react";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function TodayPage() {
  const ctx = await getBabyContext();
  const entries = await getEntries(ctx.baby.id);

  const now = new Date();
  const day = dayOfLife(ctx.baby.birth_at, now);
  const track = new Set(ctx.baby.tracked_types);

  // Norms are per-24h, so the KPI window is the last 24 hours.
  const last24 = entries.filter(
    (e) => now.getTime() - new Date(e.occurred_at).getTime() <= DAY_MS
  );
  // Nappy quota (NCT): each nappy is one slot; dirty = has a poo, else wet.
  const nappies = last24.filter((e) => e.type === "nappy");
  const dirtyCount = nappies.filter((e) => e.dirty).length;
  const wetCount = nappies.length - dirtyCount;
  const feeds = summariseFeeds(last24);

  // Sleep in the last 24h — sum the portion of each sleep that falls in-window.
  const windowStart = now.getTime() - DAY_MS;
  const sleepMs = entries
    .filter((e) => e.type === "sleep" && e.ended_at)
    .reduce((sum, e) => {
      const s = Math.max(new Date(e.occurred_at).getTime(), windowStart);
      const en = Math.min(new Date(e.ended_at!).getTime(), now.getTime());
      return sum + Math.max(0, en - s);
    }, 0);
  const sleepHrs = Math.round((sleepMs / 3_600_000) * 10) / 10;

  const latestWeight = entries.find((e) => e.type === "weight");
  const band = expectedWeightBand(day, ctx.baby.birth_weight_g);
  const ws = latestWeight
    ? weightStatus(latestWeight.weight_g!, ctx.baby.birth_weight_g)
    : null;

  const colourKey = expectedColourKey(day, feeds.mix);
  const colourText = expectedColour(day, feeds.mix);

  // "Next feed due" (client-rendered for correct timezone): needs the last
  // feed and the typical recent gap for context.
  const gaps = feedGaps(entries);
  const recentGaps = gaps.slice(-6).map((g) => g.gapMs);
  const typicalGap = recentGaps.length >= 2 ? median(recentGaps) : null;
  const lastFeed = entries
    .filter((e) => e.type === "feed")
    .sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    )[0];

  return (
    <div className="space-y-4 animate-rise">
      {/* Hero — bleeds to the top & side edges so the warm glow reaches the
          top of the screen instead of sitting below a strip of bare sand. */}
      <div className="relative -mx-4 -mt-6 overflow-hidden rounded-b-3xl px-6 pb-11 pt-28 text-center">
        <SkyArc />
        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            {ctx.baby.name}
          </h1>
          <p className="stat-num mt-1 text-5xl text-ink/90">Day {day}</p>
          <p className="mt-2 text-sm text-muted">
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
      </div>

      {/* Next feed due — only when an interval is configured in Profile */}
      {track.has("feed") && ctx.baby.feed_interval_min && lastFeed && (
        <NextFeedCard
          lastFeedStartISO={lastFeed.occurred_at}
          intervalMin={ctx.baby.feed_interval_min}
          typicalGapMs={typicalGap}
        />
      )}

      {/* Nappy quota */}
      {track.has("nappy") && (
        <NappyQuota day={day} dirtyCount={dirtyCount} wetCount={wetCount} />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {track.has("feed") && (
          <KpiCard
            label="Feeds · last 24h"
            value={String(feeds.sessions)}
            target={EXPECTED_FEEDS.label}
            tone={feeds.sessions >= EXPECTED_FEEDS.min ? "positive" : "watch"}
          />
        )}
        {track.has("sleep") && (
          <KpiCard
            label="Sleep · last 24h"
            value={sleepMs > 0 ? `${sleepHrs}h` : "—"}
            sub="newborns often 14–17h"
          />
        )}
        {track.has("weight") && (
          <KpiCard
            label="Latest weight"
            value={latestWeight ? formatKg(latestWeight.weight_g!) : "—"}
            sub={`expected ${formatKg(band.low)}–${formatKg(band.high)}`}
            tone={
              latestWeight
                ? latestWeight.weight_g! >= band.low
                  ? "positive"
                  : "watch"
                : "neutral"
            }
          />
        )}
      </div>

      {/* Feeding today */}
      {track.has("feed") && (
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <CardTitle>Feeding · last 24h</CardTitle>
          <Chip tone={feeds.mix === "breast" ? "positive" : "accent"}>
            {mixLabel(feeds.mix)}
          </Chip>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-surface-alt p-3">
            <p className="stat-num text-xl">{feeds.breastCount}</p>
            <p className="text-xs text-muted">breastfeeds</p>
            {feeds.breastMin > 0 && (
              <p className="text-xs text-faint">{feeds.breastMin} min</p>
            )}
          </div>
          <div className="rounded-2xl bg-surface-alt p-3">
            <p className="stat-num text-xl">{feeds.expressedMl}</p>
            <p className="text-xs text-muted">ml expressed</p>
          </div>
          <div className="rounded-2xl bg-surface-alt p-3">
            <p className="stat-num text-xl">{feeds.formulaMl}</p>
            <p className="text-xs text-muted">ml formula</p>
          </div>
        </div>
        {feeds.mix === "mixed" && (
          <p className="mt-3 text-sm text-muted">
            While formula is in the mix, expect stools between tan-pasty and
            yellow-seedy — trending tan → yellow-seedy as breastfeeding takes
            over is a good sign.
          </p>
        )}
      </Card>
      )}

      {/* Colour to expect */}
      {track.has("nappy") && (
      <Card className="p-5">
        <CardTitle>Colour to expect · day {day}</CardTitle>
        <div className="mt-3 flex items-start gap-3">
          <span
            className="mt-0.5 h-8 w-8 shrink-0 rounded-full border border-black/10"
            style={{ background: STOOL_COLOURS[colourKey].swatch }}
          />
          <p className="text-sm leading-relaxed">{colourText}</p>
        </div>
        <p className="mt-3 text-xs text-muted">
          Pale/white/chalky stool or blood always needs same-day advice,
          whatever the day.
        </p>
      </Card>
      )}

      {/* Weight vs birth */}
      {track.has("weight") && latestWeight && ws && (
        <Card className="p-5">
          <CardTitle>Weight vs birth</CardTitle>
          <div className="mt-2 flex items-baseline gap-2">
            <p
              className={`stat-num text-3xl ${
                ws.tone === "positive"
                  ? "text-positive"
                  : ws.tone === "alert"
                    ? "text-alert"
                    : ws.tone === "watch"
                      ? "text-[#A45A1B]"
                      : "text-ink"
              }`}
            >
              {ws.pct >= 0 ? "+" : ""}
              {ws.pct.toFixed(1)}%
            </p>
            <p className="text-sm text-muted">
              {formatKg(latestWeight.weight_g!)} vs{" "}
              {formatKg(ctx.baby.birth_weight_g)} at birth
            </p>
          </div>
          <p className="mt-1.5 text-sm text-muted">{ws.message}</p>
        </Card>
      )}

      {/* Red flags */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-alert" />
          <CardTitle className="text-alert">When to get help</CardTitle>
        </div>
        <ul className="mt-3 space-y-2">
          {RED_FLAGS.map((f, i) => (
            <li key={i} className="flex gap-2 text-sm leading-snug">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-alert" />
              {f}
            </li>
          ))}
        </ul>
      </Card>

      <p className="px-2 pb-2 text-center text-xs text-faint">{DISCLAIMER}</p>
    </div>
  );
}
