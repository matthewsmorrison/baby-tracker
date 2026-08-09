import type { BabySex } from "./types";

// WHO Child Growth Standards — length/height-for-age and head-circumference-
// for-age, the other two red book charts. Values are the official WHO LMS
// parameters (all have L = 1, i.e. normally distributed), in cm: weekly
// resolution through 13 weeks where growth is steepest, monthly through 24
// months beyond — same scheme as lib/whoWeight.ts, each range taken from
// WHO's table for that resolution.
//
// Every row below is checked against the official WHO tables vendored in
// data/who/ by scripts/verify-who-tables.mjs — run it after any edit here.
type LMS = [x: number, L: number, M: number, S: number];

const BOYS_LENGTH_WEEKLY: LMS[] = [
  [0, 1, 49.8842, 0.03795],
  [1, 1, 51.1152, 0.03723],
  [2, 1, 52.3461, 0.03652],
  [3, 1, 53.3905, 0.03609],
  [4, 1, 54.3881, 0.0357],
  [5, 1, 55.3374, 0.03534],
  [6, 1, 56.2357, 0.03501],
  [7, 1, 57.0851, 0.0347],
  [8, 1, 57.8889, 0.03442],
  [9, 1, 58.6536, 0.03416],
  [10, 1, 59.3872, 0.03392],
  [11, 1, 60.0894, 0.03369],
  [12, 1, 60.7605, 0.03348],
  [13, 1, 61.4013, 0.03329],
];

const BOYS_LENGTH_MONTHLY: LMS[] = [
  [0, 1, 49.8842, 0.03795],
  [1, 1, 54.7244, 0.03557],
  [2, 1, 58.4249, 0.03424],
  [3, 1, 61.4292, 0.03328],
  [4, 1, 63.886, 0.03257],
  [5, 1, 65.9026, 0.03204],
  [6, 1, 67.6236, 0.03165],
  [7, 1, 69.1645, 0.03139],
  [8, 1, 70.5994, 0.03124],
  [9, 1, 71.9687, 0.03117],
  [10, 1, 73.2812, 0.03118],
  [11, 1, 74.5388, 0.03125],
  [12, 1, 75.7488, 0.03137],
  [13, 1, 76.9186, 0.03154],
  [14, 1, 78.0497, 0.03174],
  [15, 1, 79.1458, 0.03197],
  [16, 1, 80.2113, 0.03222],
  [17, 1, 81.2487, 0.0325],
  [18, 1, 82.2587, 0.03279],
  [19, 1, 83.2418, 0.0331],
  [20, 1, 84.1996, 0.03342],
  [21, 1, 85.1348, 0.03376],
  [22, 1, 86.0477, 0.0341],
  [23, 1, 86.941, 0.03445],
  [24, 1, 87.8161, 0.03479],
];

const GIRLS_LENGTH_WEEKLY: LMS[] = [
  [0, 1, 49.1477, 0.0379],
  [1, 1, 50.3298, 0.03742],
  [2, 1, 51.512, 0.03694],
  [3, 1, 52.4695, 0.03669],
  [4, 1, 53.3809, 0.03647],
  [5, 1, 54.2454, 0.03627],
  [6, 1, 55.0642, 0.03609],
  [7, 1, 55.8406, 0.03593],
  [8, 1, 56.5767, 0.03578],
  [9, 1, 57.2761, 0.03564],
  [10, 1, 57.9436, 0.03552],
  [11, 1, 58.5816, 0.0354],
  [12, 1, 59.1922, 0.0353],
  [13, 1, 59.7773, 0.0352],
];

const GIRLS_LENGTH_MONTHLY: LMS[] = [
  [0, 1, 49.1477, 0.0379],
  [1, 1, 53.6872, 0.0364],
  [2, 1, 57.0673, 0.03568],
  [3, 1, 59.8029, 0.0352],
  [4, 1, 62.0899, 0.03486],
  [5, 1, 64.0301, 0.03463],
  [6, 1, 65.7311, 0.03448],
  [7, 1, 67.2873, 0.03441],
  [8, 1, 68.7498, 0.0344],
  [9, 1, 70.1435, 0.03444],
  [10, 1, 71.4818, 0.03452],
  [11, 1, 72.771, 0.03464],
  [12, 1, 74.015, 0.03479],
  [13, 1, 75.2176, 0.03496],
  [14, 1, 76.3817, 0.03514],
  [15, 1, 77.5099, 0.03534],
  [16, 1, 78.6055, 0.03555],
  [17, 1, 79.671, 0.03576],
  [18, 1, 80.7079, 0.03598],
  [19, 1, 81.7182, 0.0362],
  [20, 1, 82.7036, 0.03643],
  [21, 1, 83.6654, 0.03666],
  [22, 1, 84.604, 0.03688],
  [23, 1, 85.5202, 0.03711],
  [24, 1, 86.4153, 0.03734],
];

const BOYS_HEAD_WEEKLY: LMS[] = [
  [0, 1, 34.4618, 0.03686],
  [1, 1, 35.1634, 0.03472],
  [2, 1, 35.8649, 0.03258],
  [3, 1, 36.5216, 0.03197],
  [4, 1, 37.0926, 0.03148],
  [5, 1, 37.601, 0.03107],
  [6, 1, 38.0609, 0.03072],
  [7, 1, 38.4824, 0.03041],
  [8, 1, 38.8724, 0.03014],
  [9, 1, 39.2368, 0.0299],
  [10, 1, 39.5797, 0.02969],
  [11, 1, 39.9033, 0.0295],
  [12, 1, 40.2096, 0.02933],
  [13, 1, 40.5008, 0.02918],
];

const BOYS_HEAD_MONTHLY: LMS[] = [
  [0, 1, 34.4618, 0.03686],
  [1, 1, 37.2759, 0.03133],
  [2, 1, 39.1285, 0.02997],
  [3, 1, 40.5135, 0.02918],
  [4, 1, 41.6317, 0.02868],
  [5, 1, 42.5576, 0.02837],
  [6, 1, 43.3306, 0.02817],
  [7, 1, 43.9803, 0.02804],
  [8, 1, 44.53, 0.02796],
  [9, 1, 44.9998, 0.02792],
  [10, 1, 45.4051, 0.0279],
  [11, 1, 45.7573, 0.02789],
  [12, 1, 46.0661, 0.02789],
  [13, 1, 46.3395, 0.02789],
  [14, 1, 46.5844, 0.02791],
  [15, 1, 46.806, 0.02792],
  [16, 1, 47.0088, 0.02795],
  [17, 1, 47.1962, 0.02797],
  [18, 1, 47.3711, 0.028],
  [19, 1, 47.5357, 0.02803],
  [20, 1, 47.6919, 0.02806],
  [21, 1, 47.8408, 0.0281],
  [22, 1, 47.9833, 0.02813],
  [23, 1, 48.1201, 0.02817],
  [24, 1, 48.2515, 0.02821],
];

const GIRLS_HEAD_WEEKLY: LMS[] = [
  [0, 1, 33.8787, 0.03496],
  [1, 1, 34.5529, 0.03374],
  [2, 1, 35.2272, 0.03251],
  [3, 1, 35.843, 0.03231],
  [4, 1, 36.3761, 0.03215],
  [5, 1, 36.8472, 0.03202],
  [6, 1, 37.2711, 0.03191],
  [7, 1, 37.6584, 0.03182],
  [8, 1, 38.0167, 0.03173],
  [9, 1, 38.3516, 0.03166],
  [10, 1, 38.6673, 0.03158],
  [11, 1, 38.9661, 0.03152],
  [12, 1, 39.2501, 0.03146],
  [13, 1, 39.521, 0.0314],
];

const GIRLS_HEAD_MONTHLY: LMS[] = [
  [0, 1, 33.8787, 0.03496],
  [1, 1, 36.5463, 0.0321],
  [2, 1, 38.2521, 0.03168],
  [3, 1, 39.5328, 0.0314],
  [4, 1, 40.5817, 0.03119],
  [5, 1, 41.459, 0.03102],
  [6, 1, 42.1995, 0.03087],
  [7, 1, 42.829, 0.03075],
  [8, 1, 43.3671, 0.03063],
  [9, 1, 43.83, 0.03053],
  [10, 1, 44.2319, 0.03044],
  [11, 1, 44.5844, 0.03035],
  [12, 1, 44.8965, 0.03027],
  [13, 1, 45.1752, 0.03019],
  [14, 1, 45.4265, 0.03012],
  [15, 1, 45.6551, 0.03006],
  [16, 1, 45.865, 0.02999],
  [17, 1, 46.0598, 0.02993],
  [18, 1, 46.2424, 0.02987],
  [19, 1, 46.4152, 0.02982],
  [20, 1, 46.5801, 0.02977],
  [21, 1, 46.7384, 0.02972],
  [22, 1, 46.8913, 0.02967],
  [23, 1, 47.0391, 0.02962],
  [24, 1, 47.1822, 0.02957],
];

export type GrowthMeasure = "length" | "head";

const DAYS_PER_MONTH = 30.4375;

const TABLES: Record<GrowthMeasure, Record<BabySex, { weekly: LMS[]; monthly: LMS[] }>> = {
  length: {
    boy: { weekly: BOYS_LENGTH_WEEKLY, monthly: BOYS_LENGTH_MONTHLY },
    girl: { weekly: GIRLS_LENGTH_WEEKLY, monthly: GIRLS_LENGTH_MONTHLY },
  },
  head: {
    boy: { weekly: BOYS_HEAD_WEEKLY, monthly: BOYS_HEAD_MONTHLY },
    girl: { weekly: GIRLS_HEAD_WEEKLY, monthly: GIRLS_HEAD_MONTHLY },
  },
};

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

function lmsFor(measure: GrowthMeasure, sex: BabySex, ageDays: number) {
  const t = TABLES[measure][sex];
  return ageDays <= 91
    ? interpLMS(t.weekly, ageDays / 7)
    : interpLMS(t.monthly, ageDays / DAYS_PER_MONTH);
}

/** Measurement (cm) at a z-score for measure + sex + age — a centile-curve point. */
export function whoMeasureAtZ(
  measure: GrowthMeasure,
  sex: BabySex,
  ageDays: number,
  z: number
): number {
  const { L, M, S } = lmsFor(measure, sex, ageDays);
  const v = Math.abs(L) < 1e-7 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
  return Math.round(v * 10) / 10;
}

/** Standard normal CDF (Zelen & Severo approximation). */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.821256 + t * 1.3302744))));
  return z > 0 ? 1 - p : p;
}

/** The centile (0–100) a measurement (cm) sits on for measure + sex + age. */
export function whoMeasureCentile(
  measure: GrowthMeasure,
  sex: BabySex,
  ageDays: number,
  valueCm: number
): number {
  const { L, M, S } = lmsFor(measure, sex, ageDays);
  const ratio = valueCm / M;
  const z = Math.abs(L) < 1e-7 ? Math.log(ratio) / S : (Math.pow(ratio, L) - 1) / (L * S);
  return normalCdf(z) * 100;
}
