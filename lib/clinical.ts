// Clinical logic — the single source of truth for day-of-life norms, feeding
// mix and weight bands, used by the output screens AND the AI analysis route.
//
// General newborn norms only — this module must not gain diagnostic
// thresholds beyond what is here. The app is a tracking aid, not medical
// advice.
//
// Everything is computed from an entry's occurred_at (never "now") so
// backdated entries are always assessed against the correct day of life.

import type { BabySex, Entry, FeedMix, StoolColourKey } from "./types";
import { whoWeightBand } from "./whoWeight";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Day of life: the day of birth is day 1. Always pass the entry's occurred_at. */
export function dayOfLife(birthAt: string | Date, occurredAt: string | Date): number {
  const birth = new Date(birthAt).getTime();
  const at = new Date(occurredAt).getTime();
  return Math.max(1, Math.floor((at - birth) / DAY_MS) + 1);
}


/** Expected feeds in 24h — general norm, all days. */
export const EXPECTED_FEEDS = { min: 8, max: 12, label: "8–12" };

/**
 * Expected nappies per day, per NCT's day-by-day guidance ("Newborn baby poo
 * in nappies"). It's a quota: `total` nappies in 24h, of which at least
 * `minDirty` should be dirty (poos ≥ a £2 coin from day 3). More dirty than
 * the minimum — up to all of them — is fine; the concern is falling short of
 * the total or the dirty minimum.
 */
export interface NappyExpectation {
  total: number;
  minDirty: number;
  wetLabel: string;
  dirtyLabel: string;
  note: string;
}
export function expectedNappies(day: number): NappyExpectation {
  if (day <= 2)
    return {
      total: 3,
      minDirty: 1,
      wetLabel: "2+",
      dirtyLabel: "1+ meconium",
      note: "Meconium (dark, sticky) is normal now.",
    };
  if (day <= 4)
    return {
      total: 5,
      minDirty: 2,
      wetLabel: "3+",
      dirtyLabel: "2+ (≥ £2 coin)",
      note: "Poo changing to green ‘changing stools’ as milk comes in.",
    };
  if (day <= 6)
    return {
      total: 7,
      minDirty: 2,
      wetLabel: "5+ heavy",
      dirtyLabel: "2+ soft yellow (≥ £2 coin)",
      note: "No more meconium — soft yellow poos, at least £2-coin sized.",
    };
  return {
    total: 8,
    minDirty: 2,
    wetLabel: "6+ heavy",
    dirtyLabel: "2+ (> £2 coin)",
    note: "At least two good yellow poos a day — bigger than a £2 coin, not just skid marks.",
  };
}

export const STOOL_COLOURS: Record<
  StoolColourKey,
  { label: string; swatch: string; warn?: boolean }
> = {
  meconium: { label: "Meconium (black-green)", swatch: "#2E2E28" },
  transitional: { label: "Transitional (green-brown)", swatch: "#6E5A34" },
  yellow: { label: "Yellow (breastfed)", swatch: "#E3B44A" },
  tan: { label: "Tan (formula/mixed)", swatch: "#BFA173" },
  brown: { label: "Brown (formula)", swatch: "#7A5A3A" },
  green: { label: "Green", swatch: "#5C7A3A" },
  pale: { label: "Pale / chalky ⚠", swatch: "#ECE7D6", warn: true },
  blood: { label: "Blood ⚠", swatch: "#9E3B32", warn: true },
};

/**
 * The stool colour to expect for a day of life and feeding mix.
 * Days 1–4 are meconium → transitional regardless of feeding; from day 5 the
 * mix decides: breastfed/EBM = yellow seedy, formula = tan/brown pasty,
 * mixed = in between (tan trending yellow as breastfeeding increases).
 */
export function expectedColourKey(day: number, mix: FeedMix): StoolColourKey {
  if (day <= 2) return "meconium";
  if (day <= 4) return "transitional";
  if (mix === "formula") return "brown";
  if (mix === "mixed") return "tan";
  return "yellow"; // breast or unknown — default to the breastfed norm
}

export function expectedColour(day: number, mix: FeedMix): string {
  if (day <= 2) return "Meconium — black-green, tarry and sticky";
  if (day <= 4) return "Transitional — green-brown, looser as milk comes in";
  if (mix === "formula")
    return "Tan to brown, pasty (like peanut butter), stronger smelling — normal on formula";
  if (mix === "mixed")
    return "Anywhere from tan-pasty to yellow-seedy. Trending tan → yellow and seedier is a good sign breastfeeding is taking over";
  return "Mustard yellow, seedy and quite runny — normal for breastmilk (including expressed)";
}

export interface FeedSummary {
  breastCount: number;
  breastMin: number;
  formulaMl: number;
  expressedMl: number;
  sessions: number;
  mix: FeedMix;
}

/**
 * Summarise feed entries into counts and a feeding mix.
 * Expressed breastmilk counts as BREAST — only formula shifts stool type.
 * For per-entry context (AI analysis), pass the feeds from the 24h before
 * that entry's occurred_at, not the last 24h of wall-clock time.
 */
export function summariseFeeds(entries: Entry[]): FeedSummary {
  const feeds = entries.filter((e) => e.type === "feed");
  let breastCount = 0;
  let breastMin = 0;
  let formulaMl = 0;
  let expressedMl = 0;

  for (const f of feeds) {
    // Combined-feed columns, with legacy volume_ml fallback for old rows.
    const mins = (f.left_min ?? 0) + (f.right_min ?? 0);
    if (mins > 0) {
      breastCount += 1;
      breastMin += mins;
    }
    expressedMl +=
      f.expressed_ml ?? (f.feed_type === "expressed" ? (f.volume_ml ?? 0) : 0);
    formulaMl +=
      f.formula_ml ?? (f.feed_type === "formula" ? (f.volume_ml ?? 0) : 0);
  }

  const hasBreast = breastCount > 0 || expressedMl > 0;
  const hasFormula = formulaMl > 0;
  const mix: FeedMix =
    hasBreast && hasFormula
      ? "mixed"
      : hasFormula
        ? "formula"
        : hasBreast
          ? "breast"
          : "unknown";

  return { breastCount, breastMin, formulaMl, expressedMl, sessions: feeds.length, mix };
}

/** Feeds within the 24h window ending at an entry's occurred_at — for backdating-correct mix. */
export function feedsBefore(entries: Entry[], occurredAt: string | Date): Entry[] {
  const end = new Date(occurredAt).getTime();
  const start = end - DAY_MS;
  return entries.filter((e) => {
    if (e.type !== "feed") return false;
    const t = new Date(e.occurred_at).getTime();
    return t > start && t <= end;
  });
}

/**
 * A rough "typical" weight-for-day guide, anchored to birth weight — NOT the
 * official growth chart. NHS guidance (nhs.uk, reviewed 2023): babies lose a
 * little in the first days, and MOST are back to their birthweight by about
 * 3 weeks; a health visitor supports you if there's a large loss or it's not
 * regained by 3 weeks. The real reference is the UK-WHO centile charts in the
 * red book. So: nadir ~day 3–4 (~6% loss), gradually regained by ~day 21,
 * then ~150–200 g/week.
 */
const WEIGHT_ANCHORS: Array<[day: number, fractionOfBirth: number]> = [
  [1, 1.0],
  [3, 0.945],
  [4, 0.94], // nadir (~6% loss)
  [7, 0.955],
  [10, 0.97],
  [14, 0.985],
  [21, 1.0], // back to birth weight by ~3 weeks (NHS)
];

const REGAIN_DAY = 21;
const WEEKLY_GAIN_G = 175; // midpoint of 150–200 g/week once regained

export function expectedWeightBand(
  day: number,
  birthWeightG: number
): { low: number; mid: number; high: number } {
  let mid: number;
  if (day >= REGAIN_DAY) {
    mid = birthWeightG + ((day - REGAIN_DAY) / 7) * WEEKLY_GAIN_G;
  } else {
    let lo = WEIGHT_ANCHORS[0];
    let hi = WEIGHT_ANCHORS[WEIGHT_ANCHORS.length - 1];
    for (let i = 0; i < WEIGHT_ANCHORS.length - 1; i++) {
      if (day >= WEIGHT_ANCHORS[i][0] && day <= WEIGHT_ANCHORS[i + 1][0]) {
        lo = WEIGHT_ANCHORS[i];
        hi = WEIGHT_ANCHORS[i + 1];
        break;
      }
    }
    const span = hi[0] - lo[0] || 1;
    const t = (day - lo[0]) / span;
    mid = birthWeightG * (lo[1] + t * (hi[1] - lo[1]));
  }
  mid = Math.round(mid);
  // Wide-ish margin (~3% of birth weight) — babies vary a lot and this is a
  // rough guide, not a centile chart.
  const margin = Math.max(80, Math.round(birthWeightG * 0.03));
  return { low: mid - margin, mid, high: mid + margin };
}

/**
 * The weight band to plot for a given day of life. When the baby's sex is
 * known we use the sex-specific WHO weight-for-age centiles (2nd–98th, with
 * the 50th as the median); otherwise a rough birthweight-anchored guide.
 */
export function weightBand(
  day: number,
  birthWeightG: number,
  sex: BabySex | null
): { low: number; mid: number; high: number } {
  if (sex) return whoWeightBand(sex, day);
  return expectedWeightBand(day, birthWeightG);
}

/** Weight change vs birth, with the 7% / 10% loss thresholds. */
export function weightStatus(
  weightG: number,
  birthWeightG: number
): {
  pct: number;
  tone: "positive" | "neutral" | "watch" | "alert";
  message: string;
} {
  const pct = ((weightG - birthWeightG) / birthWeightG) * 100;
  if (pct >= 0)
    return {
      pct,
      tone: "positive",
      message: "At or above birth weight — the line is heading the right way.",
    };
  const loss = -pct;
  if (loss > 10)
    return {
      pct,
      tone: "alert",
      message: "More than 10% below birth weight — seek advice from your midwife or doctor now.",
    };
  if (loss > 7)
    return {
      pct,
      tone: "watch",
      message: "More than 7% below birth weight — mention this to your midwife today.",
    };
  return {
    pct,
    tone: "neutral",
    message:
      "Within the normal early loss range (up to ~7%). Most babies are back to birthweight by about 3 weeks.",
  };
}

/** Red flags to watch — general safety-netting, not diagnosis. */
export const RED_FLAGS: string[] = [
  "Pale, white or chalky stool at any age — contact your midwife or GP today",
  "Blood in the nappy (in stool or urine) — seek advice today",
  "Meconium (black, tarry) stool still appearing at day 5 or later",
  "Fewer wet nappies than expected for the day, or dark/strong urine after day 4",
  "Weight loss of more than 10% from birth weight",
  "Baby unusually sleepy, floppy, or hard to wake for feeds",
  "Fewer than 6 feeds in 24 hours, or refusing feeds",
  "Jaundice that is worsening, or a jaundiced baby who is sleepy and feeding poorly",
  "Dry mouth, sunken fontanelle, or no tears when crying",
];

/**
 * A used nappy this much heavier than a dry one counts as wet. Not a clinical
 * threshold — just a floor above scale noise (1 g ≈ 1 ml of urine).
 */
export const NAPPY_WET_THRESHOLD_G = 15;

/** Grams of output in a used nappy, when the dry base weight is known. */
export function nappyOutputG(
  nappyWeightG: number | null | undefined,
  baseWeightG: number | null | undefined
): number | null {
  if (!nappyWeightG || !baseWeightG) return null;
  return Math.max(0, nappyWeightG - baseWeightG);
}

/**
 * A normal single wee is roughly 30–45 ml once feeding is established
 * (Naître et grandir, "Is my baby getting enough milk?").
 */
export const URINE_PER_WEE_ML = { min: 30, max: 45 };

/** Rough stool mass for the AI's photo estimate (rough by design). */
export const STOOL_G_BY_AMOUNT: Record<string, number> = {
  none: 0,
  smear: 3,
  small: 10,
  medium: 25,
  large: 45,
};
/** Typical newborn stool mass, used when a dirty nappy has no photo estimate. */
export const DEFAULT_STOOL_G = 20;

/**
 * Estimated urine in a weighed nappy, in ml (1 g ≈ 1 ml): total output minus
 * a typical newborn stool mass when the nappy is dirty.
 */
export function estimatedUrineMl(
  entry: Entry,
  baseWeightG: number | null | undefined
): number | null {
  const out = nappyOutputG(entry.nappy_weight_g, baseWeightG);
  if (out === null) return null;
  const stool = entry.dirty ? DEFAULT_STOOL_G : 0;
  return Math.max(0, out - stool);
}

export const DISCLAIMER =
  "Beanlo is a tracking aid, not medical advice or diagnosis. If you are worried about your baby, contact your midwife, health visitor or doctor.";

/** Formatting helper: grams → \"3.62 kg\" */
export function formatKg(g: number): string {
  return `${(g / 1000).toFixed(2)} kg`;
}

export function mixLabel(mix: FeedMix): string {
  switch (mix) {
    case "breast":
      return "Breastmilk only";
    case "mixed":
      return "Mixed feeding";
    case "formula":
      return "Formula only";
    default:
      return "No feeds logged";
  }
}
