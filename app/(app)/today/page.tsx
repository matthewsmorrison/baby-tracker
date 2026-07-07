import { getBabyContext, getEntries } from "@/lib/data";
import {
  DISCLAIMER,
  EXPECTED_FEEDS,
  RED_FLAGS,
  STOOL_COLOURS,
  dayOfLife,
  expectedColour,
  expectedColourKey,
  expectedDirty,
  expectedWeightBand,
  expectedWet,
  formatKg,
  mixLabel,
  summariseFeeds,
  weightStatus,
} from "@/lib/clinical";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { KpiCard } from "@/components/output/KpiCard";
import { AlertTriangle } from "lucide-react";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function TodayPage() {
  const ctx = await getBabyContext();
  const entries = await getEntries(ctx.baby.id);

  const now = new Date();
  const day = dayOfLife(ctx.baby.birth_at, now);

  // Norms are per-24h, so the KPI window is the last 24 hours.
  const last24 = entries.filter(
    (e) => now.getTime() - new Date(e.occurred_at).getTime() <= DAY_MS
  );
  const nappies = last24.filter((e) => e.type === "nappy");
  const wetCount = nappies.filter((e) => e.wet).length;
  const dirtyCount = nappies.filter((e) => e.dirty).length;
  const feeds = summariseFeeds(last24);

  const wet = expectedWet(day);
  const dirty = expectedDirty(day);

  const latestWeight = entries.find((e) => e.type === "weight");
  const band = expectedWeightBand(day, ctx.baby.birth_weight_g);
  const ws = latestWeight
    ? weightStatus(latestWeight.weight_g!, ctx.baby.birth_weight_g)
    : null;

  const colourKey = expectedColourKey(day, feeds.mix);
  const colourText = expectedColour(day, feeds.mix);

  return (
    <div className="space-y-4 animate-rise">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl px-6 py-10 text-center">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 90% at 50% 0%, var(--bg-glow), transparent 75%)",
          }}
        />
        <p className="text-sm font-medium text-muted">{ctx.baby.name}</p>
        <p className="stat-num text-6xl mt-1">Day {day}</p>
        <p className="mt-2 text-sm text-muted">
          {now.toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Wet · last 24h"
          value={String(wetCount)}
          target={wet.label}
          tone={wetCount >= wet.min ? "positive" : "watch"}
        />
        <KpiCard
          label="Dirty · last 24h"
          value={String(dirtyCount)}
          target={dirty.label}
          tone={dirtyCount >= dirty.min ? "positive" : "watch"}
        />
        <KpiCard
          label="Feeds · last 24h"
          value={String(feeds.sessions)}
          target={EXPECTED_FEEDS.label}
          tone={feeds.sessions >= EXPECTED_FEEDS.min ? "positive" : "watch"}
        />
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
      </div>

      {/* Feeding today */}
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

      {/* Colour to expect */}
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

      {/* Weight vs birth */}
      {latestWeight && ws && (
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
