---
name: add-guidance
description: Add an official health leaflet or guidance topic to Bea's lookup_uk_guidance library (lib/guidance.ts). Use when the user shares a leaflet/URL to teach Bea, says "add this guidance", or reports Bea giving out-of-date or wrong clinical guidance.
---

# Add guidance to Bea's library

Bea retrieves official UK guidance on demand via the `lookup_uk_guidance`
tool, backed by `lib/guidance.ts`. Two tiers:

- **`GUIDANCE_DOCS`** — full text, returned verbatim, treated by Bea as
  authoritative over her own recall. For high-stakes content (medicine
  dosing, vaccination protocols, safety rules) where paraphrase drift or
  model recall could hurt someone.
- **`GUIDANCE_INDEX`** — pointer entries (title, source, topics, searchHint).
  Bea chains these into `web_search`. For everything else — cheap to add,
  nothing to keep in sync.

## The iron rule

**Never write clinical numbers, doses, ages or thresholds from memory.**
A full-text doc may only be added after fetching the source in this session
(WebFetch the URL; PDFs get saved and can be Read directly) and transcribing
from what you actually read. If the source can't be fetched, add an INDEX
pointer instead — never a from-memory doc.

## Adding a full-text doc

1. Fetch the leaflet/page (WebFetch; for PDFs, Read the saved file).
2. Add a `GuidanceDoc`:
   - `id`: kebab-case, source-prefixed (e.g. `nhs-paracetamol-doses`)
   - `source`: org + year/version (e.g. "UKHSA (2025, v4)")
   - `url`: the canonical published URL — it appears in the app's
     **Sources** footer, so it must be real and public
   - `topics`: be generous — include brand names ("calpol", "nurofen"),
     lay terms ("jabs", "poo"), and misspelling-resistant short words;
     matching is substring-based over topics+title
   - `body`: faithful to the source. Keep the source's own caveats and
     "when to seek help" lines. Structure with CAPITALISED section labels.
     If the guidance deliberately differs from something else (e.g. pack
     instructions), spell out when each rule applies.
3. If the doc supersedes an INDEX pointer on the same topic, remove the
   pointer.

## Adding an index topic

One `GuidancePointer` line: title, source org, generous `topics`, and a
`searchHint` phrased like a good search query ("NHS constipation in
babies"). No clinical content — that's the point.

If the source domain isn't already in `TRUSTED_DOMAINS`
(app/api/chat/route.ts), add it — but only official bodies (NHS, GOV.UK/
UKHSA, NICE, royal colleges, WHO, Lullaby Trust, UNICEF). Never blogs,
news sites, or commercial baby brands.

## Verify before shipping

1. `npm run build` must pass.
2. Sanity-check retrieval scoring with node (no server needed):
   the topics must actually match the questions parents would ask.
3. For a full-text doc, verify live: start a local server
   (`npx next start -p 31xx`), mint a token for `appreview@beanlo.com`
   (admin generateLink → /auth/v1/verify — see scripts/ios-test-seed.mjs
   for the pattern), POST a realistic parent question to `/api/chat`, and
   check the answer uses the new doc's numbers and cites its URL in
   **Sources**. Kill the server afterwards.
4. Commit and push — the web deploy makes it live for the iOS app
   immediately (no TestFlight build needed).

## Worked example

The library's first doc, `ukhsa-menb-paracetamol`, exists because Bea
quoted the medicine-pack rule (max 2 doses at 2–3 months) to a family
following the post-MenB protocol (3 doses, up to 4/24h). That's the bar:
capture what the official source says, including exactly when it applies
and when it doesn't.
