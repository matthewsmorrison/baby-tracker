import type { BabySex } from "./types";

// WHO Child Growth Standards — weight-for-age, the basis of the UK-WHO growth
// charts in the red book. Values are the official WHO LMS parameters
// (L = Box-Cox power, M = median kg, S = coefficient of variation), by age in
// completed months, 0–24. Centiles are derived with the LMS method.
//
// ⚠️ Entered from the WHO Child Growth Standards tables. Sanity-check against
// the official WHO data / the printed charts before clinical reliance — this
// is a guide, not a substitute for the red book.
type LMS = [month: number, L: number, M: number, S: number];

const BOYS: LMS[] = [
  [0, 0.3487, 3.3464, 0.14602],
  [1, 0.2297, 4.4709, 0.13395],
  [2, 0.197, 5.5675, 0.12385],
  [3, 0.1738, 6.3762, 0.11727],
  [4, 0.1553, 7.0023, 0.11316],
  [5, 0.1395, 7.5105, 0.1108],
  [6, 0.1257, 7.934, 0.10958],
  [7, 0.1134, 8.297, 0.10902],
  [8, 0.1021, 8.6151, 0.10882],
  [9, 0.0917, 8.9014, 0.10881],
  [10, 0.082, 9.1649, 0.10891],
  [11, 0.073, 9.4122, 0.10906],
  [12, 0.0644, 9.6479, 0.10925],
  [13, 0.0563, 9.8749, 0.10949],
  [14, 0.0487, 10.0953, 0.10976],
  [15, 0.0413, 10.3108, 0.11007],
  [16, 0.0343, 10.5228, 0.11041],
  [17, 0.0275, 10.7319, 0.11079],
  [18, 0.0211, 10.9385, 0.11119],
  [19, 0.0148, 11.143, 0.11164],
  [20, 0.0087, 11.3462, 0.11211],
  [21, 0.0029, 11.5486, 0.11261],
  [22, -0.0028, 11.7504, 0.11314],
  [23, -0.0083, 11.9514, 0.11369],
  [24, -0.0137, 12.1515, 0.11426],
];

const GIRLS: LMS[] = [
  [0, 0.3809, 3.2322, 0.14171],
  [1, 0.1714, 4.1873, 0.13724],
  [2, 0.0962, 5.1282, 0.12619],
  [3, 0.0402, 5.8458, 0.1194],
  [4, -0.005, 6.4237, 0.1153],
  [5, -0.043, 6.8985, 0.11259],
  [6, -0.0756, 7.297, 0.1108],
  [7, -0.1039, 7.6422, 0.10958],
  [8, -0.1288, 7.9487, 0.10871],
  [9, -0.1507, 8.2254, 0.10811],
  [10, -0.17, 8.48, 0.10764],
  [11, -0.1872, 8.7192, 0.10727],
  [12, -0.2024, 8.9481, 0.10697],
  [13, -0.2158, 9.1699, 0.10674],
  [14, -0.2278, 9.387, 0.10656],
  [15, -0.2384, 9.6008, 0.10643],
  [16, -0.2478, 9.8124, 0.10634],
  [17, -0.2562, 10.0226, 0.10628],
  [18, -0.2637, 10.2315, 0.10625],
  [19, -0.2703, 10.4393, 0.10623],
  [20, -0.2762, 10.6464, 0.10622],
  [21, -0.2815, 10.8534, 0.10622],
  [22, -0.2862, 11.0608, 0.10621],
  [23, -0.2903, 11.2688, 0.1062],
  [24, -0.2941, 11.4775, 0.10618],
];

// Weekly LMS values for the first 13 weeks, taken from the official WHO
// daily weight-for-age table (weianthro, ages 0/7/14/…/91 days). The monthly
// table above is too coarse here: linear interpolation between month rows
// flattens the steep early curve the printed charts show.
const BOYS_WEEKLY: LMS[] = [
  [0, 0.3487, 3.3464, 0.14602],
  [1, 0.2776, 3.4879, 0.14483],
  [2, 0.2581, 3.7529, 0.14142],
  [3, 0.2442, 4.0603, 0.13807],
  [4, 0.2331, 4.3671, 0.13497],
  [5, 0.2237, 4.659, 0.13215],
  [6, 0.2155, 4.9303, 0.1296],
  [7, 0.2081, 5.1817, 0.12729],
  [8, 0.2014, 5.4149, 0.1252],
  [9, 0.1952, 5.6319, 0.1233],
  [10, 0.1894, 5.8346, 0.12157],
  [11, 0.184, 6.0242, 0.12001],
  [12, 0.1789, 6.2019, 0.1186],
  [13, 0.174, 6.369, 0.11732],
];

const GIRLS_WEEKLY: LMS[] = [
  [0, 0.3809, 3.2322, 0.14171],
  [1, 0.2671, 3.3388, 0.146],
  [2, 0.2304, 3.5693, 0.14339],
  [3, 0.2024, 3.8352, 0.1406],
  [4, 0.1789, 4.0987, 0.13805],
  [5, 0.1582, 4.3476, 0.13583],
  [6, 0.1395, 4.5793, 0.13392],
  [7, 0.1224, 4.795, 0.13228],
  [8, 0.1065, 4.9959, 0.13087],
  [9, 0.0918, 5.1842, 0.12966],
  [10, 0.0779, 5.3618, 0.12861],
  [11, 0.0648, 5.5295, 0.1277],
  [12, 0.0525, 5.6883, 0.12691],
  [13, 0.0407, 5.8393, 0.12622],
];

// 2nd and 98th centiles (the UK-WHO practical "normal" outer lines).
const Z_LOW = -2.0537;
const Z_HIGH = 2.0537;
const DAYS_PER_MONTH = 30.4375;

/** Linear interpolation over an LMS table, clamped to its bounds. The first
 *  column's unit (weeks or months) just has to match `x`. */
function interpLMS(table: LMS[], x: number): { L: number; M: number; S: number } {
  const clamped = Math.max(table[0][0], Math.min(table[table.length - 1][0], x));
  const hiIdx = table.findIndex((r) => r[0] >= clamped);
  if (hiIdx <= 0) {
    const r = table[Math.max(0, hiIdx)];
    return { L: r[1], M: r[2], S: r[3] };
  }
  const lo = table[hiIdx - 1];
  const hi = table[hiIdx];
  const t = (clamped - lo[0]) / (hi[0] - lo[0]);
  return {
    L: lo[1] + t * (hi[1] - lo[1]),
    M: lo[2] + t * (hi[2] - lo[2]),
    S: lo[3] + t * (hi[3] - lo[3]),
  };
}

/** LMS parameters for sex + age: weekly resolution through 13 weeks (where
 *  the curve is steepest), monthly through 24 months beyond. */
function lmsFor(sex: BabySex, ageDays: number): { L: number; M: number; S: number } {
  if (ageDays <= 91) {
    return interpLMS(sex === "boy" ? BOYS_WEEKLY : GIRLS_WEEKLY, ageDays / 7);
  }
  return interpLMS(sex === "boy" ? BOYS : GIRLS, ageDays / DAYS_PER_MONTH);
}

/** Weight (kg) at a z-score using the LMS method. */
function lmsWeight(L: number, M: number, S: number, z: number): number {
  return Math.abs(L) < 1e-7
    ? M * Math.exp(S * z)
    : M * Math.pow(1 + L * S * z, 1 / L);
}

/**
 * WHO weight-for-age band for a baby of the given sex at an age in days:
 * 2nd centile (low), median (mid) and 98th centile (high), in grams.
 */
export function whoWeightBand(
  sex: BabySex,
  ageDays: number
): { low: number; mid: number; high: number } {
  const { L, M, S } = lmsFor(sex, ageDays);
  return {
    low: Math.round(lmsWeight(L, M, S, Z_LOW) * 1000),
    mid: Math.round(M * 1000),
    high: Math.round(lmsWeight(L, M, S, Z_HIGH) * 1000),
  };
}

// The nine centile lines printed on the UK-WHO (red book) growth charts,
// with their exact z-scores.
export const UK_WHO_CENTILES = [
  { label: "0.4", z: -2.6521 },
  { label: "2", z: -2.0537 },
  { label: "9", z: -1.3408 },
  { label: "25", z: -0.6745 },
  { label: "50", z: 0 },
  { label: "75", z: 0.6745 },
  { label: "91", z: 1.3408 },
  { label: "98", z: 2.0537 },
  { label: "99.6", z: 2.6521 },
] as const;

/** Weight (grams) at a given z-score for sex + age — one point on a centile curve. */
export function whoWeightAtZ(sex: BabySex, ageDays: number, z: number): number {
  const { L, M, S } = lmsFor(sex, ageDays);
  return Math.round(lmsWeight(L, M, S, z) * 1000);
}

/** Standard normal CDF (Zelen & Severo approximation, |error| < 7.5e-8). */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.821256 + t * 1.3302744))));
  return z > 0 ? 1 - p : p;
}

/**
 * The centile (0–100) a weight sits on for sex + age, via the inverse LMS
 * transform. A guide for parents — the plotted red book remains the clinical
 * reference.
 */
export function whoCentile(sex: BabySex, ageDays: number, weightG: number): number {
  const { L, M, S } = lmsFor(sex, ageDays);
  const ratio = weightG / 1000 / M;
  const z = Math.abs(L) < 1e-7 ? Math.log(ratio) / S : (Math.pow(ratio, L) - 1) / (L * S);
  return normalCdf(z) * 100;
}
