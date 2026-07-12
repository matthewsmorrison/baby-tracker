// Prediction engines built on the baby's own logged rhythm, with
// self-grading: every new log automatically scores the prediction that
// preceded it, so the cards can say how often the guess has actually been
// right. Pure and client-safe — the Today cards run these in the viewer's
// timezone.
//
//  · predictNextFeed — next feed start, from recent feed gaps
//  · predictNextNap  — the "sweet spot" nap window, from wake windows
//    between logged sleeps (age-appropriate defaults until there's history)

import { median } from "./entryDisplay";

/** Predictions count as a hit when within ± this many minutes of the feed. */
export const PREDICTION_TOLERANCE_MIN = 20;

// Gaps outside this range are almost certainly missed logging (or a growth
//-spurt outlier) rather than rhythm — leave them out of the sample.
const MIN_GAP_MS = 20 * 60 * 1000;
const MAX_GAP_MS = 8 * 60 * 60 * 1000;
// How many recent gaps of the matching day/night period inform the guess.
const SAMPLE = 10;
// Nights run 22:00–07:00 local — newborn stretches differ day vs night.
const NIGHT_START_H = 22;
const NIGHT_END_H = 7;

export interface PredictionAccuracy {
  /** Backtested feeds that had enough history to predict. */
  n: number;
  /** How many of those the prediction got within the tolerance. */
  hits: number;
}

export interface FeedPrediction {
  /** When the next feed is likely to start (epoch ms). */
  nextAtMs: number;
  /** The typical gap the guess is based on (ms). */
  typicalGapMs: number;
  /** Self-graded accuracy over recent feeds, if there was enough history. */
  accuracy: PredictionAccuracy | null;
}

function isNight(ms: number): boolean {
  const h = new Date(ms).getHours();
  return h >= NIGHT_START_H || h < NIGHT_END_H;
}

/** The typical gap following a feed at `fromMs`, from the history of feed
 *  start times before it (same day/night period preferred). */
function typicalGapAfter(startsAsc: number[], fromMs: number): number | null {
  const gaps: Array<{ from: number; gapMs: number }> = [];
  for (let i = 1; i < startsAsc.length; i++) {
    if (startsAsc[i] > fromMs) break;
    const gapMs = startsAsc[i] - startsAsc[i - 1];
    if (gapMs >= MIN_GAP_MS && gapMs <= MAX_GAP_MS) {
      gaps.push({ from: startsAsc[i - 1], gapMs });
    }
  }
  if (gaps.length < 3) return null;
  const samePeriod = gaps.filter((g) => isNight(g.from) === isNight(fromMs));
  const pool = samePeriod.length >= 3 ? samePeriod : gaps;
  return median(pool.slice(-SAMPLE).map((g) => g.gapMs));
}

/**
 * Predict the next feed from feed start times (any order), and backtest the
 * same predictor against the baby's own recent feeds. Returns null until
 * there's enough history to say anything (4+ feeds).
 */
export function predictNextFeed(
  feedStartsMs: number[],
  maxBacktest = 30
): FeedPrediction | null {
  const starts = [...feedStartsMs].sort((a, b) => a - b);
  if (starts.length < 4) return null;

  const last = starts[starts.length - 1];
  const typicalGapMs = typicalGapAfter(starts, last);
  if (!typicalGapMs) return null;

  // Self-grading: for each recent feed, predict it from only the feeds before
  // it and check whether the real start landed within the tolerance.
  let n = 0;
  let hits = 0;
  const firstEvaluable = Math.max(4, starts.length - maxBacktest);
  for (let i = firstEvaluable; i < starts.length; i++) {
    const prev = starts[i - 1];
    const gap = typicalGapAfter(starts.slice(0, i), prev);
    if (!gap) continue;
    n += 1;
    const errMs = Math.abs(prev + gap - starts[i]);
    if (errMs <= PREDICTION_TOLERANCE_MIN * 60 * 1000) hits += 1;
  }

  return {
    nextAtMs: last + typicalGapMs,
    typicalGapMs,
    accuracy: n >= 5 ? { n, hits } : null,
  };
}

// --- Nap window ("sweet spot") ---------------------------------------------

export interface SleepSpan {
  startMs: number;
  /** null while the sleep is still ongoing. */
  endMs: number | null;
}

export interface NapPrediction {
  /** The sweet-spot window to start settling the baby (epoch ms). */
  windowStartMs: number;
  windowEndMs: number;
  /** When the baby last woke (epoch ms). */
  lastWokeMs: number;
  /** The typical awake stretch the window is centred on (ms). */
  typicalWakeMs: number;
  /** Whether the guess comes from the baby's own logs or an age default. */
  basis: "observed" | "age";
  /** Self-graded accuracy over recent naps (observed basis only). */
  accuracy: PredictionAccuracy | null;
}

// Awake stretches outside this range are almost certainly missed logging.
const WAKE_MIN_MS = 15 * 60 * 1000;
const WAKE_MAX_MS = 5 * 60 * 60 * 1000;

// Typical awake-stretch defaults by age (midpoints of common UK guidance),
// used until the baby's own logs can speak for themselves.
const AGE_WAKE_WINDOW: Array<[maxAgeDays: number, minutes: number]> = [
  [28, 50],
  [60, 75],
  [90, 90],
  [120, 105],
  [180, 135],
  [270, 180],
  [365, 210],
  [545, 285],
  [Infinity, 330],
];

function ageWakeWindowMs(ageDays: number): number {
  const row = AGE_WAKE_WINDOW.find(([max]) => ageDays <= max)!;
  return row[1] * 60 * 1000;
}

/** Awake stretches between consecutive logged sleeps, oldest → newest. */
function wakeWindows(
  spans: SleepSpan[]
): Array<{ wokeAtMs: number; windowMs: number }> {
  const ended = spans
    .filter((s): s is { startMs: number; endMs: number } => s.endMs !== null)
    .sort((a, b) => a.startMs - b.startMs);
  const out: Array<{ wokeAtMs: number; windowMs: number }> = [];
  for (let i = 1; i < ended.length; i++) {
    const windowMs = ended[i].startMs - ended[i - 1].endMs;
    if (windowMs >= WAKE_MIN_MS && windowMs <= WAKE_MAX_MS) {
      out.push({ wokeAtMs: ended[i - 1].endMs, windowMs });
    }
  }
  return out;
}

/** Typical awake stretch after waking at `wokeAtMs`, from windows before it
 *  (same day/night period preferred). Needs 4+ windows to say anything. */
function typicalWakeAfter(
  windows: Array<{ wokeAtMs: number; windowMs: number }>,
  wokeAtMs: number
): number | null {
  const prior = windows.filter((w) => w.wokeAtMs < wokeAtMs);
  if (prior.length < 4) return null;
  const samePeriod = prior.filter(
    (w) => isNight(w.wokeAtMs) === isNight(wokeAtMs)
  );
  const pool = samePeriod.length >= 4 ? samePeriod : prior;
  return median(pool.slice(-SAMPLE).map((w) => w.windowMs));
}

/**
 * Predict the sweet-spot window for the next sleep. Returns null while the
 * baby is (logged as) asleep, or when there are no ended sleeps at all. Falls
 * back to age-typical wake windows until 4+ awake stretches are logged.
 */
export function predictNextNap(
  spans: SleepSpan[],
  birthAtMs: number,
  nowMs = Date.now(),
  maxBacktest = 30
): NapPrediction | null {
  // A sleep logged as started but not ended → the baby is asleep right now.
  const asleep = spans.some(
    (s) =>
      s.endMs === null &&
      s.startMs <= nowMs &&
      nowMs - s.startMs < 12 * 60 * 60 * 1000
  );
  if (asleep) return null;

  const lastWokeMs = spans
    .filter((s) => s.endMs !== null && s.endMs <= nowMs)
    .reduce((max, s) => Math.max(max, s.endMs!), 0);
  if (!lastWokeMs) return null;

  const windows = wakeWindows(spans);
  const observed = typicalWakeAfter(windows, nowMs);
  const ageDays = Math.max(
    1,
    Math.floor((nowMs - birthAtMs) / (24 * 60 * 60 * 1000)) + 1
  );
  const typicalWakeMs = observed ?? ageWakeWindowMs(ageDays);
  const basis: NapPrediction["basis"] = observed ? "observed" : "age";

  // The sweet spot: ±15% of the typical stretch, within 10–30 minutes.
  const tol = Math.min(
    Math.max(typicalWakeMs * 0.15, 10 * 60 * 1000),
    30 * 60 * 1000
  );

  // Self-grading: predict each recent awake stretch from only the windows
  // before it, and check the real nap start landed within the tolerance.
  let n = 0;
  let hits = 0;
  const firstEvaluable = Math.max(4, windows.length - maxBacktest);
  for (let i = firstEvaluable; i < windows.length; i++) {
    const guess = typicalWakeAfter(windows.slice(0, i), windows[i].wokeAtMs);
    if (!guess) continue;
    n += 1;
    if (Math.abs(guess - windows[i].windowMs) <= tol) hits += 1;
  }

  return {
    windowStartMs: lastWokeMs + typicalWakeMs - tol,
    windowEndMs: lastWokeMs + typicalWakeMs + tol,
    lastWokeMs,
    typicalWakeMs,
    basis,
    accuracy: basis === "observed" && n >= 5 ? { n, hits } : null,
  };
}
