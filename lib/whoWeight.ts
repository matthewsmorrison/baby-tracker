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

// 2nd and 98th centiles (the UK-WHO practical "normal" outer lines).
const Z_LOW = -2.0537;
const Z_HIGH = 2.0537;
const DAYS_PER_MONTH = 30.4375;

function interpLMS(table: LMS[], months: number): { L: number; M: number; S: number } {
  const m = Math.max(0, Math.min(24, months));
  const hiIdx = table.findIndex((r) => r[0] >= m);
  if (hiIdx <= 0) {
    const r = table[Math.max(0, hiIdx)];
    return { L: r[1], M: r[2], S: r[3] };
  }
  const lo = table[hiIdx - 1];
  const hi = table[hiIdx];
  const t = (m - lo[0]) / (hi[0] - lo[0]);
  return {
    L: lo[1] + t * (hi[1] - lo[1]),
    M: lo[2] + t * (hi[2] - lo[2]),
    S: lo[3] + t * (hi[3] - lo[3]),
  };
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
  const months = ageDays / DAYS_PER_MONTH;
  const { L, M, S } = interpLMS(sex === "boy" ? BOYS : GIRLS, months);
  return {
    low: Math.round(lmsWeight(L, M, S, Z_LOW) * 1000),
    mid: Math.round(M * 1000),
    high: Math.round(lmsWeight(L, M, S, Z_HIGH) * 1000),
  };
}
