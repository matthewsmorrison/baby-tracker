import { getBabyContext, getEntries } from "@/lib/data";
import {
  DISCLAIMER,
  EXPECTED_FEEDS,
  RED_FLAGS,
  STOOL_COLOURS,
  dayOfLife,
  expectedColour,
  expectedColourKey,
  weightBand,
  formatKg,
  mixLabel,
  summariseFeeds,
  weightStatus,
} from "@/lib/clinical";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { KpiCard } from "@/components/output/KpiCard";
import { NappyQuota } from "@/components/output/NappyQuota";
import { NextFeedCard } from "@/components/output/NextFeedCard";
import { NextNapCard } from "@/components/output/NextNapCard";
import { SkyArc } from "@/components/output/SkyArc";
import { AlertTriangle, Pill } from "lucide-react";

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

  // Pumping in the last 24h — sessions and total expressed.
  const pumps24 = last24.filter((e) => e.type === "pump");
  const pumpMl = pumps24.reduce((sum, e) => sum + (e.expressed_ml ?? 0), 0);

  // The signed-in carer's own sleep in the last 24h (their entries only).
  const carerSleepMs = entries
    .filter(
      (e) =>
        e.type === "carer_sleep" && e.ended_at && e.created_by === ctx.userId
    )
    .reduce((sum, e) => {
      const s = Math.max(new Date(e.occurred_at).getTime(), windowStart);
      const en = Math.min(new Date(e.ended_at!).getTime(), now.getTime());
      return sum + Math.max(0, en - s);
    }, 0);
  const carerSleepHrs = Math.round((carerSleepMs / 3_600_000) * 10) / 10;

  // Mother's medications currently being taken (started, not yet stopped).
  // Managed in Profile now, so always shown when present (no track toggle).
  const activeMeds = entries.filter(
    (e) =>
      e.type === "medication" &&
      new Date(e.occurred_at) <= now &&
      (!e.ended_at || new Date(e.ended_at) >= now)
  );

  const latestWeight = entries.find((e) => e.type === "weight");
  const band = weightBand(day, ctx.baby.birth_weight_g, ctx.baby.sex);
  const ws = latestWeight
    ? weightStatus(latestWeight.weight_g!, ctx.baby.birth_weight_g)
    : null;

  const colourKey = expectedColourKey(day, feeds.mix);
  const colourText = expectedColour(day, feeds.mix);

  // Prediction cards (client-rendered for correct timezone): feeds predict
  // the next feed from recent gaps; sleeps predict the nap "sweet spot" from
  // awake stretches between logged sleeps.
  const feedStarts = entries
    .filter((e) => e.type === "feed")
    .map((e) => e.occurred_at);
  const sleepSpans = entries
    .filter((e) => e.type === "sleep")
    .map((e) => ({ start: e.occurred_at, end: e.ended_at }));

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

      {/* Next feed due — from the configured interval, or Bea's rhythm guess */}
      {track.has("feed") && feedStarts.length > 0 && (
        <NextFeedCard
          feedStartsISO={feedStarts}
          intervalMin={ctx.baby.feed_interval_min}
        />
      )}

      {/* Nap sweet spot — teases until the first sleep is logged, then
          predicts; hides itself while asleep or once long past */}
      {track.has("sleep") && (
        <NextNapCard sleeps={sleepSpans} birthAt={ctx.baby.birth_at} />
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
        {track.has("pump") && (
          <KpiCard
            label="Pumped · last 24h"
            value={pumpMl > 0 ? `${pumpMl} ml` : "—"}
            sub={`${pumps24.length} ${pumps24.length === 1 ? "session" : "sessions"}`}
          />
        )}
        {track.has("carer_sleep") && (
          <KpiCard
            label="Your sleep · last 24h"
            value={carerSleepMs > 0 ? `${carerSleepHrs}h` : "—"}
            sub="your own logged rest"
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
                      ? "text-watch"
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

      {/* Mother's medication (active courses) */}
      {activeMeds.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Pill className="h-4 w-4 text-muted" />
            <CardTitle>
              {activeMeds.some((m) => m.med_subject === "baby")
                ? "Medication"
                : "Mother’s medication"}
            </CardTitle>
          </div>
          <ul className="mt-3 space-y-2">
            {activeMeds.map((m) => (
              <li key={m.id} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">
                    {m.med_name}
                    {m.med_subject === "baby" && (
                      <span className="ml-1.5 font-normal text-muted">
                        (baby)
                      </span>
                    )}
                    {m.med_dose && (
                      <span className="ml-1.5 font-normal text-muted">
                        {m.med_dose}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    since{" "}
                    {new Date(m.occurred_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                {m.reminder_times && m.reminder_times.length > 0 && (
                  <p className="mt-0.5 text-xs text-faint">
                    Reminders at {m.reminder_times.join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-faint">
            Some medication passes into breastmilk and can shift stool colour —
            e.g. iron often makes it darker or greener.
          </p>
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
