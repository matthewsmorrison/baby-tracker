import "server-only";
import {
  dayOfLife,
  estimatedUrineMl,
  expectedNappies,
  expectedWeightBand,
  summariseFeeds,
  weightStatus,
} from "./clinical";
import { feedAmounts, feedGaps, formatGap } from "./entryDisplay";
import { whoCentile } from "./whoWeight";
import { whoMeasureCentile } from "./whoGrowth";
import type { Baby, BabySex, Entry } from "./types";

// The baby's data serialised for Claude — shared by the Ask chat, the daily
// digest, the handover report and note drafting, so they all see the same
// numbers. The whole (small) dataset goes into the prompt; the arithmetic is
// done here, not in the model.

export const BEA_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export function fmt(iso: string, tz: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleString("en-GB", { timeZone: tz, ...opts });
}

const SLEEP_LOCATION_LABEL: Record<string, string> = {
  cot: "cot",
  arms: "in arms",
  pram: "pram",
  car_seat: "car seat",
  next_to_me: "next-to-me",
  other: "other",
};
const SETTLE_LABEL: Record<string, string> = {
  self: "self-settled",
  fed: "fed to sleep",
  rocked: "rocked",
  dummy: "dummy",
  other: "other",
};

/** "63rd" etc. — matches the app's centile phrasing. */
function ordinal(pct: number): string {
  if (pct < 0.4) return "below the 0.4th";
  if (pct > 99.6) return "above the 99.6th";
  const r = Math.round(pct);
  const suffix =
    r % 100 >= 11 && r % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][r % 10] ?? "th";
  return `${r}${suffix}`;
}

function ageDays(baby: Baby, at: string): number {
  return Math.max(
    0,
    (new Date(at).getTime() - new Date(baby.birth_at).getTime()) / 86_400_000
  );
}

/**
 * UK-WHO growth summary: every weigh-in with its centile, plus the latest
 * length/head centiles. This is the red-book framing Bea should use for any
 * weight/growth question — centiles and curve-tracking, not just "% vs birth".
 */
export function growthBlock(baby: Baby, entries: Entry[], tz: string): string {
  const sex = baby.sex as BabySex | null;
  const measurements = entries
    .filter((e) => e.type === "weight")
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
  if (!sex) {
    return `\n\n## Growth (UK-WHO centiles)\nSex isn't set for ${baby.name}, so centiles can't be computed — suggest setting it in Settings if the parent asks about centiles. Fall back to weight vs birth and the expected regain-by-day-14–21 pattern.`;
  }

  const weightLines = measurements
    .filter((e) => e.weight_g)
    .map((e) => {
      const day = dayOfLife(baby.birth_at, e.occurred_at);
      const c = whoCentile(sex, ageDays(baby, e.occurred_at), e.weight_g!);
      const when = fmt(e.occurred_at, tz, { day: "numeric", month: "short" });
      return { day, line: `Day ${day} (${when}): ${e.weight_g}g — ${ordinal(c)} centile`, c };
    });

  const latest = measurements[measurements.length - 1];
  const extra: string[] = [];
  if (latest?.length_mm) {
    const c = whoMeasureCentile("length", sex, ageDays(baby, latest.occurred_at), latest.length_mm / 10);
    extra.push(`Latest length ${(latest.length_mm / 10).toFixed(1)}cm — ${ordinal(c)} centile`);
  }
  if (latest?.head_circ_mm) {
    const c = whoMeasureCentile("head", sex, ageDays(baby, latest.occurred_at), latest.head_circ_mm / 10);
    extra.push(`Latest head circumference ${(latest.head_circ_mm / 10).toFixed(1)}cm — ${ordinal(c)} centile`);
  }

  let trend = "";
  if (weightLines.length >= 2) {
    const prev = weightLines[weightLines.length - 2];
    const last = weightLines[weightLines.length - 1];
    const drift = last.c - prev.c;
    trend =
      Math.abs(drift) < 10
        ? `\nTrend: tracking along their curve (previous weigh-in ${ordinal(prev.c)}, latest ${ordinal(last.c)}).`
        : `\nTrend: centile has ${drift > 0 ? "risen" : "fallen"} from the ${ordinal(prev.c)} to the ${ordinal(last.c)} between the last two weigh-ins${drift < 0 ? " — a sustained drop across centile spaces is worth mentioning to the health visitor at the next weigh-in" : ""}.`;
  }

  return `\n\n## Growth (UK-WHO red-book centiles for a ${sex})
When weight or growth comes up, USE THESE CENTILES — the same nine-curve UK-WHO charts as the family's red book — rather than generic "healthy band" language. Babies are expected to roughly track their own centile curve; the absolute centile mattering less than sustained crossing of centile spaces.
${weightLines.map((w) => w.line).join("\n") || "No weights logged yet."}${extra.length ? "\n" + extra.join("\n") : ""}${trend}`;
}

/** Context tags on a sleep line, e.g. " [cot, self-settled]". */
function sleepContext(e: Entry): string {
  const bits = [
    e.sleep_location ? SLEEP_LOCATION_LABEL[e.sleep_location] : null,
    e.settle_method ? SETTLE_LABEL[e.settle_method] : null,
  ].filter(Boolean);
  return bits.length ? ` [${bits.join(", ")}]` : "";
}

export function serialiseBaby(baby: Baby, entries: Entry[], tz: string): string {
  const asc = [...entries].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  // --- per-day aggregates (do the arithmetic here, not in the model) ---
  const byDay = new Map<string, Entry[]>();
  for (const e of asc) {
    const k = fmt(e.occurred_at, tz, { year: "numeric", month: "2-digit", day: "2-digit" });
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(e);
  }
  const gaps = feedGaps(asc);
  const gapByDay = new Map<string, number[]>();
  for (const g of gaps) {
    const k = fmt(g.at.toISOString(), tz, { year: "numeric", month: "2-digit", day: "2-digit" });
    if (!gapByDay.has(k)) gapByDay.set(k, []);
    gapByDay.get(k)!.push(g.gapMs);
  }

  const dayLines: string[] = [];
  for (const [k, dayEntries] of byDay) {
    const day = dayOfLife(baby.birth_at, dayEntries[0].occurred_at);
    const f = summariseFeeds(dayEntries);
    const nappies = dayEntries.filter((e) => e.type === "nappy");
    const wet = nappies.filter((e) => e.wet).length;
    const dirty = nappies.filter((e) => e.dirty).length;
    const weights = dayEntries
      .filter((e) => e.type === "weight" && e.weight_g)
      .map((e) => `${e.weight_g}g (${weightStatus(e.weight_g!, baby.birth_weight_g).pct.toFixed(1)}% vs birth)`);
    const urine = nappies
      .map((e) => estimatedUrineMl(e, baby.nappy_base_weight_g))
      .filter((v): v is number => v !== null);
    // Sleep started this day (ended sessions only), in ms.
    const sleepMs = dayEntries
      .filter((e) => e.type === "sleep" && e.ended_at)
      .reduce(
        (s, e) =>
          s + (new Date(e.ended_at!).getTime() - new Date(e.occurred_at).getTime()),
        0
      );
    const dayGaps = gapByDay.get(k) ?? [];
    const avgGap = dayGaps.length
      ? formatGap(dayGaps.reduce((a, b) => a + b, 0) / dayGaps.length)
      : "n/a";
    const label = fmt(dayEntries[0].occurred_at, tz, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    dayLines.push(
      `Day ${day} (${label}): ${f.sessions} feeds (${f.breastMin}min nursing, ${f.expressedMl}ml EBM, ${f.formulaMl}ml formula, mix=${f.mix}); avg gap ${avgGap}; nappies ${wet} wet / ${dirty} dirty${urine.length ? `; est. urine ${urine.reduce((a, b) => a + b, 0)}ml from ${urine.length} weighed` : ""}${sleepMs > 0 ? `; sleep ${formatGap(sleepMs)}` : ""}${weights.length ? `; weight ${weights.join(", ")}` : ""}`
    );
  }

  // --- raw entries, one compact line each ---
  const lines = asc.map((e) => {
    const day = dayOfLife(baby.birth_at, e.occurred_at);
    const t = fmt(e.occurred_at, tz, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const end = e.ended_at
      ? `–${fmt(e.ended_at, tz, { hour: "2-digit", minute: "2-digit" })}`
      : "";
    if (e.type === "feed") {
      const a = feedAmounts(e);
      const parts = [
        a.left ? `L ${a.left}min` : null,
        a.right ? `R ${a.right}min` : null,
        a.expressed ? `EBM ${a.expressed}ml` : null,
        a.formula ? `formula ${a.formula}ml` : null,
      ].filter(Boolean);
      const after = [
        e.spit_up ? "spit-up" : null,
        e.post_feed_mood ? `${e.post_feed_mood} after` : null,
      ].filter(Boolean);
      const notes = e.feed_notes
        ? Object.entries(e.feed_notes)
            .map(([k, v]) => `${k}: "${v}"`)
            .join(", ")
        : "";
      return `d${day} ${t}${end} FEED ${parts.join(" + ")}${after.length ? ` (${after.join(", ")})` : ""}${notes ? ` [${notes}]` : ""}${e.note ? ` note:"${e.note}"` : ""}`;
    }
    if (e.type === "nappy") {
      const bits = [
        e.wet ? "wet" : null,
        e.dirty ? `dirty(${e.stool_colour ?? "?"})` : null,
        e.nappy_weight_g ? `${e.nappy_weight_g}g nappy` : null,
      ].filter(Boolean);
      return `d${day} ${t} NAPPY ${bits.join(", ")}${e.note ? ` note:"${e.note}"` : ""}`;
    }
    if (e.type === "sleep") {
      const dur = e.ended_at
        ? formatGap(new Date(e.ended_at).getTime() - new Date(e.occurred_at).getTime())
        : "ongoing";
      return `d${day} ${t}${end} SLEEP ${dur}${sleepContext(e)}${e.note ? ` note:"${e.note}"` : ""}`;
    }
    if (e.type === "carer_sleep") {
      const dur = e.ended_at
        ? formatGap(new Date(e.ended_at).getTime() - new Date(e.occurred_at).getTime())
        : "ongoing";
      return `d${day} ${t}${end} CARER-SLEEP ${dur}${e.note ? ` note:"${e.note}"` : ""}`;
    }
    if (e.type === "pump") {
      const dur = e.ended_at
        ? ` ${formatGap(new Date(e.ended_at).getTime() - new Date(e.occurred_at).getTime())}`
        : "";
      return `d${day} ${t}${end} PUMP ${e.expressed_ml ?? 0}ml${dur}${e.note ? ` note:"${e.note}"` : ""}`;
    }
    // Medications are summarised in their own section below, not as raw rows.
    if (e.type === "medication") return "";
    if (e.type === "temperature") {
      const high = e.temp_c !== null && e.temp_c >= 38;
      return `d${day} ${t} TEMPERATURE ${e.temp_c}°C${high ? " (HIGH — 38°C+ in a young baby needs same-day medical advice)" : ""}${e.note ? ` note:"${e.note}"` : ""}`;
    }
    if (e.type === "milestone") {
      return `d${day} ${t} MILESTONE ${e.milestone_label ?? ""}${e.note ? ` note:"${e.note}"` : ""}`;
    }
    if (e.type === "weight") {
      const extra = [
        e.length_mm ? `length ${(e.length_mm / 10).toFixed(1)}cm` : null,
        e.head_circ_mm ? `head ${(e.head_circ_mm / 10).toFixed(1)}cm` : null,
      ].filter(Boolean);
      if (!e.weight_g) {
        return `d${day} ${t} MEASUREMENTS ${extra.join(", ")}${e.note ? ` note:"${e.note}"` : ""}`;
      }
      const band = expectedWeightBand(day, baby.birth_weight_g);
      const centile = baby.sex
        ? `; ${ordinal(whoCentile(baby.sex as BabySex, ageDays(baby, e.occurred_at), e.weight_g))} centile`
        : "";
      return `d${day} ${t} WEIGHT ${e.weight_g}g (${weightStatus(e.weight_g, baby.birth_weight_g).pct.toFixed(1)}% vs birth; expected ${band.low}–${band.high}g${centile})${extra.length ? `; ${extra.join(", ")}` : ""}${e.note ? ` note:"${e.note}"` : ""}`;
    }
    return "";
  }).filter(Boolean);

  // --- rolling last-24h window (matches the app's Today screen exactly) ---
  const nowMs = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const windowStart = nowMs - DAY_MS;
  const last24 = asc.filter((e) => {
    const at = new Date(e.occurred_at).getTime();
    return at > windowStart && at <= nowMs;
  });
  const f24 = summariseFeeds(last24);
  const nappies24 = last24.filter((e) => e.type === "nappy");
  const wet24 = nappies24.filter((e) => e.wet).length;
  const dirty24 = nappies24.filter((e) => e.dirty).length;
  const urine24 = nappies24
    .map((e) => estimatedUrineMl(e, baby.nappy_base_weight_g))
    .filter((v): v is number => v !== null)
    .reduce((a, b) => a + b, 0);
  // Sleep overlapping the window (same partial-attribution as Today).
  const sleepMs24 = asc
    .filter((e) => e.type === "sleep" && e.ended_at)
    .reduce((s, e) => {
      const st = Math.max(new Date(e.occurred_at).getTime(), windowStart);
      const en = Math.min(new Date(e.ended_at!).getTime(), nowMs);
      return s + Math.max(0, en - st);
    }, 0);
  const day24 = dayOfLife(baby.birth_at, new Date());
  const exp = expectedNappies(day24);

  // Medications, as courses. The mother's may pass into breastmilk and can
  // shift stool colour/texture (e.g. iron → darker/greener), so surface them.
  const meds = asc.filter(
    (e) => e.type === "medication" && e.med_kind !== "dose"
  );
  const medsBlock = meds.length
    ? "\n\n## Medications (mother's unless marked baby — the mother's may affect breastfed stool, e.g. iron can darken/green it)\n" +
      meds
        .map((m) => {
          const from = fmt(m.occurred_at, tz, { day: "numeric", month: "short" });
          const to = m.ended_at
            ? fmt(m.ended_at, tz, { day: "numeric", month: "short" })
            : "ongoing";
          const who = m.med_subject === "baby" ? " (baby)" : "";
          return `${m.med_name ?? "medication"}${who}: ${from} → ${to}${m.note ? ` (${m.note})` : ""}`;
        })
        .join("\n")
    : "";

  // One-off doses from the last 14 days (e.g. Calpol), newest first, so Bea
  // can answer "when did she last have Calpol?".
  const doses = asc
    .filter(
      (e) =>
        e.type === "medication" &&
        e.med_kind === "dose" &&
        nowMs - new Date(e.occurred_at).getTime() <= 14 * 24 * 3_600_000
    )
    .reverse();
  const dosesBlock = doses.length
    ? "\n\n## One-off medicine doses (last 14 days, newest first — baby's unless marked mother)\n" +
      doses
        .map((m) => {
          const who = m.med_subject === "mother" ? " (mother)" : "";
          const when = fmt(m.occurred_at, tz, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          return `${m.med_name ?? "medicine"}${who}${m.med_dose ? ` ${m.med_dose}` : ""}: ${when}${m.note ? ` (${m.note})` : ""}`;
        })
        .join("\n")
    : "";

  const rolling = `## Last 24 hours (rolling window ending right now — USE THIS for any "last 24 hours", "past day", "past 24h", "so far", or "recently" question. This is what the app's Today screen shows. Do NOT substitute a single calendar-day summary for it.)
- Feeds: ${f24.sessions} (${f24.breastMin}min nursing, ${f24.expressedMl}ml EBM, ${f24.formulaMl}ml formula, mix=${f24.mix})
- Nappies: ${nappies24.length} total — ${wet24} wet, ${dirty24} dirty${urine24 > 0 ? `; est. urine ${urine24}ml` : ""}. NCT guide for day ${day24}: about ${exp.total} nappies in 24h, at least ${exp.minDirty} with poo.
- Sleep: ${Math.round((sleepMs24 / 3_600_000) * 10) / 10}h`;

  return `${rolling}${growthBlock(baby, asc, tz)}

## Daily summaries (pre-computed, per CALENDAR DAY — midnight to midnight in the family's timezone. Use these for a specific date or day of life, and for day-to-day comparisons. Do NOT use one of these as "the last 24 hours".)
${dayLines.join("\n")}

## Raw entries
${lines.join("\n")}${medsBlock}${dosesBlock}`;
}

/** The parent's notes & questions as a prompt block ("" when there are none). */
export function buildNotesBlock(
  notes: Array<{
    kind: string;
    body: string;
    answer: string | null;
    created_at: string;
  }>,
  tz: string
): string {
  if (notes.length === 0) return "";
  return (
    "\n\n## Parent's notes & questions\n" +
    notes
      .map((n) => {
        const when = fmt(n.created_at, tz, { day: "numeric", month: "short" });
        if (n.kind === "note") return `(${when}) NOTE: ${n.body}`;
        return `(${when}) Q: ${n.body}${n.answer ? `\n    A: ${n.answer}` : " (unanswered)"}`;
      })
      .join("\n")
  );
}

/** Which categories the family tracks vs not — so Bea can name her blind
 *  spots and suggest switching a tracker on instead of guessing. */
export function trackedTypesBlock(baby: Baby): string {
  const ALL: Array<{ type: string; label: string }> = [
    { type: "nappy", label: "nappies" },
    { type: "feed", label: "feeds" },
    { type: "sleep", label: "baby sleep" },
    { type: "weight", label: "weight/measurements" },
    { type: "pump", label: "pumping" },
    { type: "carer_sleep", label: "carer sleep" },
    { type: "temperature", label: "temperature" },
    { type: "milestone", label: "milestones" },
  ];
  const tracked = new Set<string>(baby.tracked_types ?? []);
  const on = ALL.filter((t) => tracked.has(t.type)).map((t) => t.label);
  const off = ALL.filter((t) => !tracked.has(t.type)).map((t) => t.label);
  return `This family currently tracks: ${on.join(", ") || "nothing"}. Not tracked: ${off.join(", ") || "nothing"}.`;
}
