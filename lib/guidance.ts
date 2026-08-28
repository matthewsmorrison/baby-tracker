import "server-only";

// Official UK guidance Bea retrieves ON DEMAND via the lookup_uk_guidance
// tool — kept out of the system prompt so it never bloats requests that
// don't need it.
//
// Two tiers:
//  - DOCS: full text we've verified against the published leaflet. Returned
//    verbatim; the model treats them as authoritative over its own recall.
//  - INDEX: pointers to official pages/leaflets we haven't embedded. The
//    tool returns the pointer and the model follows up with web_search —
//    so every leaflet is findable by default without us hand-copying it.

export interface GuidanceDoc {
  id: string;
  title: string;
  source: string;
  url: string;
  topics: string[];
  body: string;
}

export interface GuidancePointer {
  title: string;
  source: string;
  topics: string[];
  searchHint: string;
}

export const GUIDANCE_DOCS: GuidanceDoc[] = [
  {
    id: "ukhsa-menb-paracetamol",
    title: "Using paracetamol to prevent and treat fever after MenB vaccination",
    source: "UKHSA (2025, v4)",
    url: "https://assets.publishing.service.gov.uk/media/68559cfa76eec44bf9d71dae/UKHSA_Paracetamol_MenB_A4_2025_.pdf",
    topics: [
      "paracetamol", "calpol", "menb", "bexsero", "vaccination", "vaccine",
      "jabs", "immunisation", "fever", "temperature", "8 weeks", "12 weeks", "dose",
    ],
    body: `Fever is common after the MenB vaccine (Bexsero), given with the routine vaccines at 8 and 12 weeks — without paracetamol more than half of infants develop a temperature, peaking around 6 hours after vaccination and nearly always gone within 2 days.

PRODUCT: use oral INFANT paracetamol suspension 120mg/5ml only. One dose = 2.5ml (60mg). Junior/"6 plus" paracetamol (250mg/5ml) must NOT be used in babies.

RECOMMENDED PROACTIVE COURSE (babies up to 6 months having primary MenB doses, usually the 8- and 12-week appointments):
- Dose 1: one 2.5ml (60mg) dose as soon as possible after vaccination (ideally within an hour).
- Dose 2: one 2.5ml dose 4 to 6 hours after the first.
- Dose 3: one 2.5ml dose 4 to 6 hours after the second.

IF FEVER PERSISTS within 48 hours of vaccination and the baby is otherwise well: further 2.5ml doses may be given — always at least 4 hours between doses, and NEVER more than 4 doses in any 24-hour period. Keep the baby cool and offer plenty of fluids (breast milk if breastfed).

WHY THIS DIFFERS FROM THE PACK: the patient information leaflet says babies of 2–3 months should only have 2 doses before seeing a doctor/pharmacist. That pack rule exists for UNEXPLAINED fever (which could signal serious infection). After MenB vaccination the fever is expected, so experts advise the schedule above for up to 48 hours post-vaccination. Outside the vaccination context, the pack rule applies.

ALSO:
- Don't wake a sleeping baby for a dose — give it when they wake, keeping at least 4 hours between doses.
- Very premature babies (born before 32 weeks): paracetamol should be prescribed by a doctor by weight.
- Paracetamol is NOT routinely needed for the MenB booster at 12 months.
- Fever lasting more than 48 hours after vaccination, or any concern about the baby: GP or NHS 111.`,
  },
  {
    id: "nhs-paracetamol-children",
    title: "Paracetamol for children: doses and how to give it",
    source: "NHS (medicines A–Z)",
    url: "https://www.nhs.uk/medicines/paracetamol-for-children/",
    topics: [
      "paracetamol", "calpol", "dose", "doses", "syrup", "suspension",
      "pain", "fever", "temperature", "how much", "how often", "overdose",
    ],
    body: `Most children over 2 months old can take paracetamol (check with a pharmacist/GP first if the child has allergies or kidney or liver conditions).

DOSES — infant liquid/syrup 120mg/5ml:
- 3 to 5 months: 2.5ml per dose
- 6 to 23 months: 5ml per dose
- 2 to 3 years: 7.5ml per dose
- 4 to 5 years: 10ml per dose
From 3 months: up to 4 times in 24 hours if needed, waiting at least 4 hours between doses.

BABIES AGED 2 TO 3 MONTHS: only if they weigh over 4kg and were born after 37 weeks of pregnancy. Usually only 2.5ml up to 2 TIMES in a day, at least 4 hours apart — EXCEPT after the first and second MenB vaccinations, when up to 3 doses may be given to prevent a high temperature (see the UKHSA MenB paracetamol leaflet for that schedule).

LIMITS AND SAFETY:
- Do not give for more than 3 days without speaking to a doctor or pharmacist.
- If you've given more than the packet/leaflet/prescription says: get help from NHS 111.
- Only ever use INFANT suspension (120mg/5ml) in babies — never the stronger junior "6 plus" strength (250mg/5ml).`,
  },
  {
    id: "nhs-ibuprofen-children",
    title: "Ibuprofen for children: who can take it and doses",
    source: "NHS (medicines A–Z)",
    url: "https://www.nhs.uk/medicines/ibuprofen-for-children/",
    topics: [
      "ibuprofen", "nurofen", "dose", "doses", "pain", "fever",
      "temperature", "anti-inflammatory", "chickenpox", "asthma",
    ],
    body: `WHO CAN TAKE IT: babies under 1 month cannot take ibuprofen. At 1 to 3 months, only if a doctor prescribes it. Over the counter it's for babies from 3 MONTHS old weighing MORE THAN 5KG. (Contrast: paracetamol can be used from 2 months post-vaccination / over 4kg — for a younger or lighter baby, paracetamol is the over-the-counter option, not ibuprofen.)

DOSES — infant liquid 100mg/5ml:
- 3 to 5 months (over 5kg): 2.5ml (50mg), max 3 times in 24 hours
- 6 to 11 months: 2.5ml (50mg), max 3 to 4 times in 24 hours
Spacing: with 3 doses a day leave at least 6 hours between doses; with 4 doses a day leave at least 4 hours.
Give with food or milk to avoid indigestion. For a 3-5 month old, don't continue past 24 hours without speaking to a doctor.

CHECK WITH A PHARMACIST/DOCTOR FIRST if the child has asthma, allergies to ibuprofen or other medicines, stomach/heart/liver/kidney problems, a bleeding risk, inflammatory bowel disease, or signs of dehydration.

WARNING: do not give ibuprofen for CHICKENPOX unless a doctor recommends it — it can cause a serious skin reaction.`,
  },
  {
    id: "ukhsa-what-to-expect-after-vaccinations",
    title: "What to expect after vaccinations",
    source: "UKHSA (updated Dec 2025)",
    url: "https://www.gov.uk/government/publications/what-to-expect-after-vaccinations/what-to-expect-after-vaccinations",
    topics: [
      "vaccination", "vaccine", "jabs", "immunisation", "side effects",
      "reaction", "fever", "temperature", "swelling", "lump", "injection",
      "unsettled", "crying", "fit", "convulsion", "rash",
    ],
    body: `NORMAL REACTIONS: babies may cry for a bit after the injection but usually settle soon with a cuddle or a feed — most have no other reaction. Some have swelling, redness or a small hard lump at the injection site, sore to touch; it lasts 2 to 3 days and needs no treatment.

FEVER (over 38°C) is a common vaccine reaction. Do NOT sponge the baby down or use a fan to cool them; keep them cool with light clothing/bedding and offer plenty of fluids. Fever is VERY common when the MenB vaccine is given with the other routine vaccines at 2 and 3 months — for those appointments UKHSA advises a proactive 3-dose infant-paracetamol course (see the MenB paracetamol leaflet for the exact schedule). Never give aspirin to a child under 16.

WHEN TO GET HELP:
- Temperature of 39–40°C or above: call the doctor immediately (if the surgery is closed, call NHS 111 or go to the nearest emergency department).
- A fit/convulsion: seek urgent medical advice. (Febrile convulsions after vaccination are rare; around 1 in 1,000 after the first MMRV dose, usually in the second week.)
- Trust your instincts — if the baby seems seriously unwell at any point, get medical help.

LATER-APPEARING REACTIONS (12-month+ vaccines, for reference): the measles component of MMRV can cause fever and a non-infectious rash 6–10 days after; mumps/rubella components occasionally facial swelling or joint pain at 2–3 weeks; the chickenpox component occasionally a few spots at 3–4 weeks.`,
  },
];

export const GUIDANCE_INDEX: GuidancePointer[] = [
  { title: "A guide to immunisations for babies up to 13 months (what's given at each appointment)", source: "UKHSA", topics: ["vaccination", "vaccine", "jabs", "immunisation", "schedule", "appointments", "which vaccines"], searchHint: "UKHSA guide to immunisations babies up to 13 months" },
  { title: "Childhood immunisation for parents of premature babies", source: "UKHSA", topics: ["premature", "preterm", "vaccination", "vaccine", "immunisation", "corrected age"], searchHint: "UKHSA childhood immunisation quick guide premature babies" },
  { title: "Newborn screening: blood spot (heel prick), hearing test and physical examination", source: "NHS", topics: ["screening", "heel prick", "blood spot", "hearing test", "nipe", "newborn checks"], searchHint: "NHS newborn screening blood spot hearing physical examination" },
  { title: "Vaccinations in pregnancy protecting the baby (whooping cough, RSV)", source: "UKHSA / NHS", topics: ["pregnancy", "whooping cough", "pertussis", "rsv", "vaccination"], searchHint: "UKHSA pregnancy how to help protect you and your baby vaccination" },
  { title: "Safer sleep for babies (reducing SIDS risk)", source: "Lullaby Trust / NHS", topics: ["sleep", "sids", "cot", "co-sleeping", "safe sleep", "position", "temperature"], searchHint: "Lullaby Trust safer sleep baby NHS SIDS" },
  { title: "Reflux in babies", source: "NHS", topics: ["reflux", "spit up", "sick", "vomit", "posset"], searchHint: "NHS reflux in babies" },
  { title: "Colic", source: "NHS", topics: ["colic", "crying", "unsettled", "evening crying"], searchHint: "NHS colic baby" },
  { title: "Constipation in babies", source: "NHS", topics: ["constipation", "poo", "straining", "hard stool", "no poo"], searchHint: "NHS constipation in babies" },
  { title: "Vitamin D and vitamin supplements for babies", source: "NHS", topics: ["vitamin", "vitamin d", "supplement", "breastfed"], searchHint: "NHS vitamins for children babies vitamin D breastfed" },
  { title: "Newborn jaundice", source: "NHS", topics: ["jaundice", "yellow", "skin", "eyes", "bilirubin"], searchHint: "NHS newborn jaundice" },
  { title: "High temperature in babies and spotting serious illness", source: "NHS", topics: ["fever", "temperature", "ill", "unwell", "sepsis", "meningitis", "rash"], searchHint: "NHS high temperature baby is your baby seriously ill" },
  { title: "Making up baby formula safely", source: "NHS", topics: ["formula", "bottle", "sterilise", "making up", "water temperature"], searchHint: "NHS making up baby formula safely" },
  { title: "Breastfeeding: cluster feeding, supply and positioning", source: "NHS / UNICEF Baby Friendly", topics: ["breastfeeding", "cluster", "supply", "latch", "positioning", "nursing"], searchHint: "NHS breastfeeding challenges cluster feeding UNICEF baby friendly" },
  { title: "Colds, coughs and blocked noses in babies", source: "NHS", topics: ["cold", "cough", "congestion", "blocked nose", "snuffly", "wheezing", "saline"], searchHint: "NHS colds coughs babies blocked nose" },
];

/** The Anthropic tool definition for the guidance lookup. */
export const GUIDANCE_TOOL = {
  name: "lookup_uk_guidance",
  description:
    "Look up official UK health guidance (UKHSA/NHS/Lullaby Trust leaflets) relevant to a topic. Returns verified full-text guidance where available (treat it as authoritative over your own recall) plus pointers to official pages worth following up with web_search. ALWAYS call this before answering questions about medicines/doses, vaccinations, safe sleep, formula preparation, or illness in a baby.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string" as const,
        description: "Topic keywords, e.g. 'paracetamol after MenB vaccination' or 'safe sleep temperature'",
      },
    },
    required: ["query"],
  },
};

function score(topics: string[], title: string, words: string[]): number {
  const hay = topics.join(" ") + " " + title.toLowerCase();
  return words.reduce((s, w) => s + (hay.includes(w) ? (w.length > 3 ? 2 : 1) : 0), 0);
}

/** Execute a lookup_uk_guidance call. Returns the tool_result text. */
export function lookupGuidance(query: string): string {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  const docs = GUIDANCE_DOCS
    .map((d) => ({ d, s: score(d.topics, d.title, words) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 2);
  const pointers = GUIDANCE_INDEX
    .map((p) => ({ p, s: score(p.topics, p.title, words) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 4);

  if (docs.length === 0 && pointers.length === 0) {
    return "No matching guidance in the library. Use web_search against trusted UK sources (NHS first, then GOV.UK/UKHSA) instead.";
  }
  const docText = docs
    .map(({ d }) => `# ${d.title}\nSource: ${d.source} — ${d.url}\n\n${d.body}`)
    .join("\n\n---\n\n");
  const pointerText = pointers.length
    ? "\n\nOFFICIAL PAGES TO FOLLOW UP WITH web_search (do this before answering if the full text above doesn't cover the question):\n" +
      pointers.map(({ p }) => `- ${p.title} (${p.source}) — search: "${p.searchHint}"`).join("\n")
    : "";
  return docText + pointerText;
}

/** URLs of docs matched by a query — for the Sources list in the app. */
export function guidanceSources(query: string): Array<{ url: string; title: string }> {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  return GUIDANCE_DOCS
    .filter((d) => score(d.topics, d.title, words) > 0)
    .map((d) => ({ url: d.url, title: `${d.title} (${d.source})` }));
}
