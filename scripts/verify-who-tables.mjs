#!/usr/bin/env node --experimental-strip-types
/**
 * Verifies the WHO Child Growth Standards data in lib/whoWeight.ts and
 * lib/whoGrowth.ts against the official WHO tables vendored in data/who/.
 *
 *   node --experimental-strip-types scripts/verify-who-tables.mjs
 *
 * Two independent checks:
 *
 *   A. Every LMS row in the TS source equals the official WHO value exactly.
 *      Catches transcription errors in the hand-entered tables.
 *   B. The centile values the app actually computes match the SD (z-score)
 *      columns WHO publishes alongside the LMS parameters. Catches errors in
 *      the LMS formula, the age interpolation and the centile z-scores, none
 *      of which check A would notice.
 *
 * Exits non-zero on any mismatch. See data/who/README.md for provenance.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { whoWeightAtZ } from "../lib/whoWeight.ts";
import { whoMeasureAtZ } from "../lib/whoGrowth.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DAYS_PER_MONTH = 30.4375;

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};

/** Vendored WHO CSV -> [{ x, L, M, S, SD3neg, ... }] */
function readCsv(name) {
  const lines = readFileSync(join(ROOT, "data/who", name), "utf8").trim().split("\n");
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map(Number);
    const row = {};
    header.forEach((h, i) => (row[i === 0 ? "x" : h] = cells[i]));
    return row;
  });
}

/** LMS arrays as written in a TS source file -> { NAME: [[x, L, M, S], ...] } */
function parseTsTables(relPath) {
  const src = readFileSync(join(ROOT, relPath), "utf8");
  const tables = {};
  for (const m of src.matchAll(/const (\w+): LMS\[\] = \[([\s\S]*?)\n\];/g)) {
    tables[m[1]] = [...m[2].matchAll(/\[([^\]]+)\]/g)].map((r) =>
      r[1].split(",").map((n) => Number(n.trim()))
    );
  }
  if (Object.keys(tables).length === 0) {
    throw new Error(`No 'const NAME: LMS[] = [...]' tables found in ${relPath} — ` +
      `the source layout changed and this check can no longer read it.`);
  }
  return tables;
}

// ---------------------------------------------------------------------------
// A. LMS parameters vs official WHO values
// ---------------------------------------------------------------------------
// Each TS table is checked against the WHO file covering the same ages. WHO
// quotes L and M to 4dp and S to 5dp, so equality is exact at that precision.
const LMS_CHECKS = [
  ["lib/whoWeight.ts", "BOYS_WEEKLY", "wfa-boys-weeks.csv"],
  ["lib/whoWeight.ts", "GIRLS_WEEKLY", "wfa-girls-weeks.csv"],
  ["lib/whoWeight.ts", "BOYS", "wfa-boys-months.csv"],
  ["lib/whoWeight.ts", "GIRLS", "wfa-girls-months.csv"],
  ["lib/whoGrowth.ts", "BOYS_LENGTH_WEEKLY", "lhfa-boys-weeks.csv"],
  ["lib/whoGrowth.ts", "GIRLS_LENGTH_WEEKLY", "lhfa-girls-weeks.csv"],
  ["lib/whoGrowth.ts", "BOYS_LENGTH_MONTHLY", "lhfa-boys-months.csv"],
  ["lib/whoGrowth.ts", "GIRLS_LENGTH_MONTHLY", "lhfa-girls-months.csv"],
  ["lib/whoGrowth.ts", "BOYS_HEAD_WEEKLY", "hcfa-boys-weeks.csv"],
  ["lib/whoGrowth.ts", "GIRLS_HEAD_WEEKLY", "hcfa-girls-weeks.csv"],
  ["lib/whoGrowth.ts", "BOYS_HEAD_MONTHLY", "hcfa-boys-months.csv"],
  ["lib/whoGrowth.ts", "GIRLS_HEAD_MONTHLY", "hcfa-girls-months.csv"],
];

console.log("A. LMS parameters vs official WHO tables");
const sources = {};
let rowsChecked = 0;
for (const [file, tableName, csv] of LMS_CHECKS) {
  sources[file] ??= parseTsTables(file);
  const table = sources[file][tableName];
  const official = new Map(readCsv(csv).map((r) => [r.x, r]));
  if (!table) {
    fail(`${tableName} not found in ${file}`);
    continue;
  }
  let bad = 0;
  for (const [x, L, M, S] of table) {
    const o = official.get(x);
    if (!o) {
      fail(`${tableName} row ${x}: no matching row in ${csv}`);
      bad++;
      continue;
    }
    for (const [label, mine, theirs] of [
      ["L", L, o.L],
      ["M", M, o.M],
      ["S", S, o.S],
    ]) {
      if (Math.abs(mine - theirs) > 1e-9) {
        fail(`${tableName} row ${x}: ${label} is ${mine}, WHO says ${theirs}`);
        bad++;
      }
    }
    rowsChecked++;
  }
  if (!bad) console.log(`  ok    ${tableName} (${table.length} rows) = ${csv}`);
}
console.log(`  ${rowsChecked} rows checked`);

// ---------------------------------------------------------------------------
// B. Computed centiles vs WHO's published SD columns
// ---------------------------------------------------------------------------
// Evaluated only at ages that land exactly on a table row, so no interpolation
// error is folded in. Two rounding steps stack up in the tolerance:
//   - WHO's own published precision: the daily tables carry 3dp, the
//     weekly/monthly tables only 1dp (so up to 0.05 either way).
//   - the app's rounding: whoWeightAtZ returns whole grams (0.0005 kg),
//     whoMeasureAtZ returns 0.1 cm (0.05 cm).
// Anything larger than their sum is a genuine disagreement.
const WHO_1DP = 0.05;
const WHO_3DP = 0.0005;
const APP_GRAM = 0.0005;
const APP_MM = 0.05;
const SD_COLUMNS = [
  ["SD3neg", -3],
  ["SD2neg", -2],
  ["SD1neg", -1],
  ["SD0", 0],
  ["SD1", 1],
  ["SD2", 2],
  ["SD3", 3],
];

const weightAt = (sex, days, z) => whoWeightAtZ(sex, days, z) / 1000;
const lengthAt = (sex, days, z) => whoMeasureAtZ("length", sex, days, z);
const headAt = (sex, days, z) => whoMeasureAtZ("head", sex, days, z);

const DERIVED_CHECKS = [
  // Newborn range, 3dp reference: exact weekly rows (day 0, 7, 14 ... 91).
  ["weight 0-13wk", "wfa-boys-days.csv", weightAt, "boy", (r) => r.x, (r) => r.x % 7 === 0, WHO_3DP + APP_GRAM],
  ["weight 0-13wk", "wfa-girls-days.csv", weightAt, "girl", (r) => r.x, (r) => r.x % 7 === 0, WHO_3DP + APP_GRAM],
  ["length 0-13wk", "lhfa-boys-days.csv", lengthAt, "boy", (r) => r.x, (r) => r.x % 7 === 0, WHO_3DP + APP_MM],
  ["length 0-13wk", "lhfa-girls-days.csv", lengthAt, "girl", (r) => r.x, (r) => r.x % 7 === 0, WHO_3DP + APP_MM],
  ["head 0-13wk", "hcfa-boys-days.csv", headAt, "boy", (r) => r.x, (r) => r.x % 7 === 0, WHO_3DP + APP_MM],
  ["head 0-13wk", "hcfa-girls-days.csv", headAt, "girl", (r) => r.x, (r) => r.x % 7 === 0, WHO_3DP + APP_MM],
  // Monthly range, 1dp reference. Skip month 0-3, covered above at finer precision.
  ["weight 3-24mo", "wfa-boys-months.csv", weightAt, "boy", (r) => r.x * DAYS_PER_MONTH, (r) => r.x >= 3, WHO_1DP + APP_GRAM],
  ["weight 3-24mo", "wfa-girls-months.csv", weightAt, "girl", (r) => r.x * DAYS_PER_MONTH, (r) => r.x >= 3, WHO_1DP + APP_GRAM],
  ["length 3-24mo", "lhfa-boys-months.csv", lengthAt, "boy", (r) => r.x * DAYS_PER_MONTH, (r) => r.x >= 3, WHO_1DP + APP_MM],
  ["length 3-24mo", "lhfa-girls-months.csv", lengthAt, "girl", (r) => r.x * DAYS_PER_MONTH, (r) => r.x >= 3, WHO_1DP + APP_MM],
  ["head 3-24mo", "hcfa-boys-months.csv", headAt, "boy", (r) => r.x * DAYS_PER_MONTH, (r) => r.x >= 3, WHO_1DP + APP_MM],
  ["head 3-24mo", "hcfa-girls-months.csv", headAt, "girl", (r) => r.x * DAYS_PER_MONTH, (r) => r.x >= 3, WHO_1DP + APP_MM],
];

console.log("\nB. Computed centiles vs WHO published SD columns");
for (const [label, csv, fn, sex, ageOf, include, tol] of DERIVED_CHECKS) {
  let n = 0;
  let worst = 0;
  let bad = 0;
  for (const row of readCsv(csv)) {
    if (!include(row)) continue;
    const days = ageOf(row);
    for (const [col, z] of SD_COLUMNS) {
      if (row[col] === undefined || Number.isNaN(row[col])) continue;
      const diff = Math.abs(fn(sex, days, z) - row[col]);
      worst = Math.max(worst, diff);
      if (diff > tol) {
        fail(`${label} ${sex} @${row.x}: z=${z} computed ${fn(sex, days, z)}, WHO ${row[col]} (off by ${diff.toFixed(4)})`);
        bad++;
      }
      n++;
    }
  }
  if (!bad) {
    console.log(`  ok    ${label} ${sex} — ${n} points, worst ${worst.toFixed(4)} (tol ${tol})`);
  }
}

// ---------------------------------------------------------------------------
// C. Informational: cost of interpolating between table rows
// ---------------------------------------------------------------------------
// The app stores weekly rows for 0-13 weeks and interpolates linearly between
// them. This reports the largest resulting error against WHO's daily table --
// not a pass/fail, just the size of the approximation.
console.log("\nC. Weekly-interpolation error vs WHO daily table (0-91 days)");
for (const [label, csv, fn, sex, unit] of [
  ["weight", "wfa-boys-days.csv", weightAt, "boy", "kg"],
  ["weight", "wfa-girls-days.csv", weightAt, "girl", "kg"],
  ["length", "lhfa-boys-days.csv", lengthAt, "boy", "cm"],
  ["length", "lhfa-girls-days.csv", lengthAt, "girl", "cm"],
  ["head", "hcfa-boys-days.csv", headAt, "boy", "cm"],
  ["head", "hcfa-girls-days.csv", headAt, "girl", "cm"],
]) {
  let worst = 0;
  let at = null;
  for (const row of readCsv(csv)) {
    for (const [col, z] of SD_COLUMNS) {
      if (row[col] === undefined || Number.isNaN(row[col])) continue;
      const diff = Math.abs(fn(sex, row.x, z) - row[col]);
      if (diff > worst) {
        worst = diff;
        at = `day ${row.x}, z=${z}`;
      }
    }
  }
  console.log(`  ${label} ${sex}: max ${worst.toFixed(4)} ${unit} (${at})`);
}

console.log(
  failures === 0
    ? "\nPASS — all tables match the official WHO Child Growth Standards."
    : `\nFAIL — ${failures} mismatch(es).`
);
process.exit(failures === 0 ? 0 : 1);
