// Audits the app's hardcoded clinical rules against live NHS/UKHSA pages.
//
//   node scripts/audit-nhs-guidance.mjs
//
// For each topic it fetches the official page, extracts the passages around
// the numbers that matter, and prints them NEXT TO the app's current
// constants (grepped from lib/clinical.ts — the iOS Clinical.swift is a
// port of the same numbers, see AGENTS.md). It does NOT change anything:
// a human (or Claude via the add-guidance skill) reviews the report and
// updates lib/clinical.ts + ios/Beanlo/Clinical.swift + their tests.
//
// Output: docs/guidance-audit.md
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const CHECKS = [
  {
    topic: "Nappy counts (wet & dirty) as a sign of enough milk",
    url: "https://www.nhs.uk/baby/breastfeeding-and-bottle-feeding/breastfeeding-problems/enough-milk/",
    keywords: [/wet nappies/i, /£2 coin/i, /poos?/i, /48 hours/i, /day 5/i],
    appFile: "lib/clinical.ts",
    appAnchor: "export function expectedNappies",
    appLines: 60,
  },
  {
    topic: "Breastfed poo frequency from ~6 weeks",
    url: "https://www.nhs.uk/best-start-in-life/baby/feeding-your-baby/breastfeeding/breastfeeding-challenges/constipation/",
    keywords: [/6 weeks/i, /several days/i, /a week/i, /soft/i, /constipat/i],
    appFile: "lib/clinical.ts",
    appAnchor: "day >= 42",
    appLines: 14,
  },
  {
    topic: "Feeds per 24h in the early weeks",
    url: "https://www.nhs.uk/baby/breastfeeding-and-bottle-feeding/breastfeeding/the-first-few-days/",
    keywords: [/8/, /12/, /feeds?/i, /24 hours/i, /cluster/i],
    appFile: "lib/clinical.ts",
    appAnchor: "EXPECTED_FEEDS",
    appLines: 3,
  },
  {
    topic: "Newborn weight loss and regain",
    url: "https://www.nhs.uk/baby/breastfeeding-and-bottle-feeding/breastfeeding-problems/enough-milk/",
    keywords: [/weight/i, /birth ?weight/i, /3 to 4 days/i, /2 weeks/i, /regain/i],
    appFile: "lib/clinical.ts",
    appAnchor: "REGAIN_DAY",
    appLines: 8,
  },
  {
    topic: "High temperature threshold in babies",
    url: "https://www.nhs.uk/symptoms/fever-in-children/",
    keywords: [/38C?/i, /39/, /temperature/i, /under 3 months/i, /3 to 6 months/i],
    appFile: "lib/clinical.ts",
    appAnchor: "38",
    appLines: 4,
  },
  {
    topic: "Safe sleep basics",
    url: "https://www.nhs.uk/conditions/sudden-infant-death-syndrome-sids/",
    keywords: [/back/i, /feet to foot/i, /16 ?°?C|20 ?°?C/i, /room/i, /smok/i],
    appFile: "lib/clinical.ts",
    appAnchor: "RED_FLAGS",
    appLines: 20,
  },
];

const strip = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&amp;|&#\d+;|&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ");

function windows(text, patterns, radius = 260) {
  const out = [];
  for (const p of patterns) {
    const re = new RegExp(p.source, p.flags.includes("g") ? p.flags : p.flags + "g");
    let m;
    let count = 0;
    while ((m = re.exec(text)) && count < 3) {
      const start = Math.max(0, m.index - radius);
      const w = text.slice(start, m.index + radius).trim();
      if (!out.some((o) => o.includes(w.slice(40, 120)))) out.push("…" + w + "…");
      count++;
    }
  }
  return out.slice(0, 6);
}

function appSnippet(file, anchor, lines) {
  const src = readFileSync(file, "utf8").split("\n");
  const i = src.findIndex((l) => l.includes(anchor));
  if (i === -1) return `(anchor "${anchor}" not found in ${file})`;
  return src.slice(i, i + lines).join("\n");
}

const report = [
  "# NHS guidance audit",
  `Generated ${new Date().toISOString().slice(0, 10)} by scripts/audit-nhs-guidance.mjs.`,
  "",
  "Compare each source extract against the app constants beneath it.",
  "Numbers that differ need a reviewed change to lib/clinical.ts AND",
  "ios/Beanlo/Clinical.swift AND their unit tests (see the add-guidance",
  "skill and the TDD rule in AGENTS.md). Never change numbers the extract",
  "doesn't support.",
  "",
];

let fetched = 0;
for (const check of CHECKS) {
  report.push(`## ${check.topic}`, "", `Source: ${check.url}`, "");
  try {
    const res = await fetch(check.url, {
      headers: { "User-Agent": "beanlo-guidance-audit/1.0" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = strip(await res.text());
    const found = windows(text, check.keywords);
    if (found.length === 0) {
      report.push("**REVIEW: page fetched but no keyword windows matched — page layout may have changed.**", "");
    } else {
      fetched++;
      report.push("### Source extracts", "");
      for (const w of found) report.push(`> ${w}`, "");
    }
  } catch (e) {
    report.push(`**REVIEW: fetch failed (${e.message}) — check the URL, it may have moved.**`, "");
  }
  report.push("### App currently says", "", "```", appSnippet(check.appFile, check.appAnchor, check.appLines), "```", "");
}

mkdirSync("docs", { recursive: true });
writeFileSync("docs/guidance-audit.md", report.join("\n"));
console.log(`Audit written to docs/guidance-audit.md (${fetched}/${CHECKS.length} sources fetched cleanly).`);
console.log("Review it topic by topic; apply changes via the add-guidance workflow.");
