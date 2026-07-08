// Clinical logic — the single source of truth for day-of-life norms, feeding
// mix and weight bands, used by the output screens AND the AI analysis route.
//
// General newborn norms only — this module must not gain diagnostic
// thresholds beyond what is here. The app is a tracking aid, not medical
// advice.
//
// Everything is computed from an entry's occurred_at (never "now") so
// backdated entries are always assessed against the correct day of life.

import type { Entry, FeedMix, StoolColourKey } from "./types";

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
 * Expected weight for a day of life, anchored to birth weight.
 * Anchor shape (example birth 3800 g): day 3 ≈ 3625, nadir ≈ day 4 (~5% loss),
 * back to birth weight by ~day 10, then +150–200 g/week. Band is ±40 g.
 */
const WEIGHT_ANCHORS: Array<[day: number, fractionOfBirth: number]> = [
  [1, 1.0],
  [2, 0.972],
  [3, 0.954], // 3800 → ≈3625
  [4, 0.948], // nadir
  [5, 0.955],
  [7, 0.975],
  [10, 1.0], // back to birth weight
];

const WEEKLY_GAIN_G = 175; // midpoint of 150–200 g/week after day 10

export function expectedWeightBand(
  day: number,
  birthWeightG: number
): { low: number; mid: number; high: number } {
  let mid: number;
  if (day >= 10) {
    mid = birthWeightG + ((day - 10) / 7) * WEEKLY_GAIN_G;
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
  return { low: mid - 40, mid, high: mid + 40 };
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
    message: "Within the normal early loss range (up to ~7%). Watch for the turn back upward.",
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
 * the stool mass — the AI's photo estimate when there is one, a typical
 * newborn stool otherwise.
 */
export function estimatedUrineMl(
  entry: Entry,
  baseWeightG: number | null | undefined
): number | null {
  const out = nappyOutputG(entry.nappy_weight_g, baseWeightG);
  if (out === null) return null;
  if (entry.ai?.estimatedUrineMl != null) return entry.ai.estimatedUrineMl;
  const stool = entry.dirty
    ? (entry.ai?.stoolAmount != null
        ? (STOOL_G_BY_AMOUNT[entry.ai.stoolAmount] ?? DEFAULT_STOOL_G)
        : DEFAULT_STOOL_G)
    : 0;
  return Math.max(0, out - stool);
}

export const DISCLAIMER =
  "Hearth is a tracking aid, not medical advice or diagnosis. If you are worried about your baby, contact your midwife, health visitor or doctor.";

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
