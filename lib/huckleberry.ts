// Huckleberry CSV import: parse the app's "Export tracking data as CSV" file
// and map each row onto a Beanlo entry insert. Pure and client-safe — the
// import screen parses the file in the browser, so timestamps (which the CSV
// stores as local time with no zone) are read in the family's own timezone.
//
// Format, confirmed against open-source parsers of real exports:
//   Type, Start, End, Duration, Start Location, Start Condition,
//   End Condition, Notes
// · Start/End: "YYYY-MM-DD HH:MM[:SS]" local time
// · Duration: "H:MM" (for Diaper rows this column holds a colour word)
// · Feed bottles: Start Location = "Bottle", Start Condition = "Breast Milk"
//   or "Formula", End Condition = amount ("120ml" / "4.0oz")
// · Pump: Start Condition / End Condition = left / right amounts in ml
// · Diaper: End Condition text mentions pee and/or poo
// Nursing rows aren't covered by those parsers, so they're handled
// defensively: per-side durations are read from Start/End Condition when they
// look like durations, otherwise the total Duration is attributed to the side
// named in Start Location. Anything unrecognised is skipped and reported —
// never guessed.

import type { Entry } from "./types";

/** An entries-row insert payload (no baby_id/created_by — added at insert). */
export type ImportDraft = Partial<Entry> & {
  type: Entry["type"];
  occurred_at: string;
  source: "huckleberry";
};

export interface ImportPlan {
  drafts: ImportDraft[];
  /** Rows with no Beanlo equivalent (Solids, Bath, …), by Huckleberry type. */
  skipped: Record<string, number>;
  /** Rows of a supported type that couldn't be parsed — samples for the UI. */
  problems: string[];
  totalRows: number;
}

// --- CSV ---------------------------------------------------------------------

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, newlines inside
 *  quotes. Returns rows of raw string cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

// --- Field parsing -----------------------------------------------------------

/** "YYYY-MM-DD HH:MM[:SS]" in the viewer's local timezone → ISO string. */
function parseLocalDateTime(s: string | undefined): string | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(
    s.trim()
  );
  if (!m) return null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? 0)
  );
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** "H:MM[:SS]", "12m", "12 min" → whole minutes (null if not a duration).
 *  A two-part value that would exceed `maxMin` as H:MM is read as MM:SS
 *  instead — guards nursing sides against the ambiguous "15:30" case. */
function parseDurationMin(
  s: string | undefined,
  maxMin = Infinity
): number | null {
  if (!s) return null;
  const t = s.trim();
  let m = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (m) {
    if (m[3] !== undefined) return Number(m[1]) * 60 + Number(m[2]); // H:MM:SS
    const asHoursMin = Number(m[1]) * 60 + Number(m[2]);
    if (asHoursMin <= maxMin) return asHoursMin;
    return Number(m[1]) + Math.round(Number(m[2]) / 60); // MM:SS
  }
  m = /^(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?$/i.exec(t);
  if (m) return Math.round(Number(m[1]));
  return null;
}

/** "120ml", "4.0oz", "120" → millilitres (null if not an amount). */
function parseVolumeMl(s: string | undefined): number | null {
  if (!s) return null;
  const m = /^(\d+(?:\.\d+)?)\s*(ml|oz)?\s*$/i.exec(s.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Math.round(m[2]?.toLowerCase() === "oz" ? n * 29.5735 : n);
}

/** Weight anywhere in the given texts: kg / g / lb (first match wins). */
function parseWeightG(texts: Array<string | undefined>): number | null {
  for (const t of texts) {
    if (!t) continue;
    const m = /(\d+(?:[.,]\d+)?)\s*(kg|lbs?|g)\b/i.exec(t);
    if (!m) continue;
    const n = Number(m[1].replace(",", "."));
    const unit = m[2].toLowerCase();
    if (unit === "kg") return Math.round(n * 1000);
    if (unit.startsWith("lb")) return Math.round(n * 453.592);
    return Math.round(n);
  }
  return null;
}

/** A plausible body temperature from the given texts (°F converted). */
function parseTempC(texts: Array<string | undefined>): number | null {
  for (const t of texts) {
    if (!t) continue;
    const m = /(\d{2,3}(?:\.\d+)?)/.exec(t);
    if (!m) continue;
    const n = Number(m[1]);
    if (n >= 30 && n <= 45) return n;
    if (n >= 86 && n <= 113) return Math.round(((n - 32) / 1.8) * 10) / 10;
  }
  return null;
}

// --- Mapping -----------------------------------------------------------------

const clean = (s: string | undefined) => {
  const t = (s ?? "").trim();
  return t.length > 0 ? t : null;
};

/**
 * Turn a parsed CSV into entry drafts. Unsupported Huckleberry types are
 * counted in `skipped`; supported rows that can't be made sense of are
 * dropped into `problems` (capped) rather than imported wrong.
 */
export function planImport(csvText: string): ImportPlan {
  const rows = parseCsv(csvText);
  const plan: ImportPlan = {
    drafts: [],
    skipped: {},
    problems: [],
    totalRows: Math.max(0, rows.length - 1),
  };
  if (rows.length < 2) return plan;

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const iType = col("Type");
  const iStart = col("Start");
  const iEnd = col("End");
  const iDuration = col("Duration");
  const iLocation = col("Start Location");
  const iStartCond = col("Start Condition");
  const iEndCond = col("End Condition");
  const iNotes = col("Notes");
  if (iType < 0 || iStart < 0) {
    plan.problems.push(
      "This doesn't look like a Huckleberry export — no Type/Start columns."
    );
    return plan;
  }
  const cell = (row: string[], i: number) =>
    i >= 0 && i < row.length ? row[i] : undefined;
  const problem = (msg: string) => {
    if (plan.problems.length < 20) plan.problems.push(msg);
    else if (plan.problems.length === 20)
      plan.problems.push("…and more — these rows were skipped, not guessed.");
  };

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const type = (cell(row, iType) ?? "").trim();
    if (!type) continue;
    const start = parseLocalDateTime(cell(row, iStart));
    if (!start) {
      problem(`Row ${r + 1} (${type}): unreadable start time.`);
      continue;
    }
    const end = parseLocalDateTime(cell(row, iEnd));
    const durationMin = parseDurationMin(cell(row, iDuration));
    const location = clean(cell(row, iLocation));
    const startCond = clean(cell(row, iStartCond));
    const endCond = clean(cell(row, iEndCond));
    const note = clean(cell(row, iNotes));

    switch (type.toLowerCase()) {
      case "sleep": {
        if (!end) {
          problem(`Row ${r + 1} (Sleep): no end time.`);
          break;
        }
        plan.drafts.push({
          type: "sleep",
          occurred_at: start,
          ended_at: end,
          note,
          source: "huckleberry",
        });
        break;
      }

      case "feed": {
        if (location?.toLowerCase() === "bottle") {
          const ml = parseVolumeMl(endCond ?? undefined);
          if (ml === null) {
            problem(`Row ${r + 1} (Bottle feed): unreadable amount.`);
            break;
          }
          const isBreastMilk = /breast/i.test(startCond ?? "");
          plan.drafts.push({
            type: "feed",
            occurred_at: start,
            ended_at: end,
            feed_type: isBreastMilk ? "expressed" : "formula",
            expressed_ml: isBreastMilk ? ml : null,
            formula_ml: isBreastMilk ? null : ml,
            note,
            source: "huckleberry",
          });
          break;
        }
        // Nursing: per-side durations when the columns look like durations,
        // else the total attributed to the named side, else a session with
        // no minutes (honest, never invented).
        let left = parseDurationMin(startCond ?? undefined, 180);
        let right = parseDurationMin(endCond ?? undefined, 180);
        if (left === null && right === null && durationMin !== null) {
          const loc = (location ?? "").toLowerCase();
          if (loc.includes("left")) left = durationMin;
          else if (loc.includes("right")) right = durationMin;
        }
        plan.drafts.push({
          type: "feed",
          occurred_at: start,
          ended_at: end,
          feed_type: "breast",
          left_min: left,
          right_min: right,
          note,
          source: "huckleberry",
        });
        break;
      }

      case "diaper": {
        const info = `${startCond ?? ""} ${endCond ?? ""}`.trim();
        const wet = /pee|wet|urine/i.test(info);
        const dirty = /poo|dirty|stool|\bbm\b/i.test(info);
        const dry = /dry/i.test(info);
        if (!wet && !dirty && !dry) {
          problem(`Row ${r + 1} (Diaper): contents unreadable ("${info}").`);
          break;
        }
        plan.drafts.push({
          type: "nappy",
          occurred_at: start,
          wet,
          dirty,
          note,
          source: "huckleberry",
        });
        break;
      }

      case "pump": {
        const leftMl = parseVolumeMl(startCond ?? undefined) ?? 0;
        const rightMl = parseVolumeMl(endCond ?? undefined) ?? 0;
        const total = leftMl + rightMl;
        if (total <= 0) {
          problem(`Row ${r + 1} (Pump): no readable amount.`);
          break;
        }
        plan.drafts.push({
          type: "pump",
          occurred_at: start,
          expressed_ml: total,
          note,
          source: "huckleberry",
        });
        break;
      }

      case "growth": {
        const weightG = parseWeightG([startCond ?? "", endCond ?? "", note ?? ""]);
        if (weightG === null) {
          problem(`Row ${r + 1} (Growth): no readable weight.`);
          break;
        }
        plan.drafts.push({
          type: "weight",
          occurred_at: start,
          weight_g: weightG,
          note,
          source: "huckleberry",
        });
        break;
      }

      case "temperature": {
        const tempC = parseTempC([startCond ?? "", endCond ?? "", note ?? ""]);
        if (tempC === null) {
          problem(`Row ${r + 1} (Temperature): no readable value.`);
          break;
        }
        plan.drafts.push({
          type: "temperature",
          occurred_at: start,
          temp_c: tempC,
          note,
          source: "huckleberry",
        });
        break;
      }

      case "meds": {
        plan.drafts.push({
          type: "medication",
          occurred_at: start,
          med_kind: "dose",
          med_subject: "baby",
          med_name: startCond ?? "Medicine",
          med_dose: endCond,
          note,
          source: "huckleberry",
        });
        break;
      }

      default:
        plan.skipped[type] = (plan.skipped[type] ?? 0) + 1;
    }
  }

  return plan;
}
