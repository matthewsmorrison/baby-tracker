import Anthropic from "@anthropic-ai/sdk";
import {
  NAPPY_WET_THRESHOLD_G,
  dayOfLife,
  expectedColour,
  feedsBefore,
  nappyOutputG,
  summariseFeeds,
} from "@/lib/clinical";
import type { AiAnalysis, Baby, Entry } from "@/lib/types";

// Server-only helpers shared by the on-upload analyser and the entry
// re-analyser. The Anthropic key never reaches the client.

export const ANALYSIS_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export type MediaType = "image/jpeg" | "image/png" | "image/webp";

export const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "visibleContents",
    "colour",
    "colourKey",
    "consistency",
    "stoolAmount",
    "sizeVs2pCoin",
    "matchesExpected",
    "summary",
  ],
  properties: {
    visibleContents: { type: "string", enum: ["poo", "wee", "both", "unclear"] },
    colour: { type: "string" },
    colourKey: {
      type: "string",
      enum: [
        "meconium",
        "transitional",
        "yellow",
        "tan",
        "brown",
        "green",
        "pale",
        "blood",
        "unclear",
      ],
      description:
        "The single best-matching stool colour category, or 'unclear' if no stool is clearly visible",
    },
    consistency: { type: "string" },
    stoolAmount: {
      type: "string",
      enum: ["none", "smear", "small", "medium", "large"],
      description:
        "How much stool is visible: none, a smear, small (~1-2 tbsp), medium (~3-5 tbsp), large (covers most of the nappy)",
    },
    sizeVs2pCoin: {
      type: "string",
      enum: ["smaller", "similar", "bigger", "unclear"],
      description:
        "Estimated size of the stool relative to a £2 coin (~28 mm across), the reference NCT uses: smaller, similar, bigger, or unclear if no stool is visible",
    },
    matchesExpected: {
      type: "string",
      enum: ["yes", "partly", "no", "unclear"],
      description:
        "Whether the stool colour matches the colour expected for this baby's feeding mix and day of life — a factual comparison, not a warning",
    },
    summary: {
      type: "string",
      description:
        "One or two calm, factual sentences describing the colour, the size vs a £2 coin, and whether the colour matches the feeding pattern. Neutral and non-alarming; no advice.",
    },
  },
} as const;

/** Context needed to phrase the labelling prompt, derived server-side. */
export function analysisContext(baby: Baby, occurredAt: string, feeds: Entry[]) {
  const day = dayOfLife(baby.birth_at, occurredAt);
  const feedSummary = summariseFeeds(feedsBefore(feeds, occurredAt));
  const expected = expectedColour(day, feedSummary.mix);
  return { day, feeds: feedSummary, expected };
}

export function buildAnalysisPrompt(opts: {
  baby: Baby;
  occurredAt: string;
  feedEntries: Entry[];
  medEntries?: Entry[];
  nappyWeightG?: number | null;
}): string {
  const { baby, occurredAt, feedEntries, medEntries, nappyWeightG } = opts;
  const { day, feeds, expected } = analysisContext(baby, occurredAt, feedEntries);

  const feedSummary =
    feeds.sessions === 0
      ? "No feeds logged in the 24h before this nappy."
      : `In the 24h before this nappy: ${feeds.breastCount} breastfeeds (${feeds.breastMin} min total), ${feeds.expressedMl} ml expressed breastmilk, ${feeds.formulaMl} ml formula. Feeding mix: ${feeds.mix}.`;

  const output = nappyOutputG(nappyWeightG ?? null, baby.nappy_base_weight_g);
  const weightContext =
    output !== null
      ? `\n- The used nappy was weighed: ${nappyWeightG} g vs a ${baby.nappy_base_weight_g} g dry nappy — about ${output} g of contents (1 g ≈ 1 ml). ${output >= NAPPY_WET_THRESHOLD_G ? "So the nappy definitely contains output, whatever the photo shows." : "Very little output by weight."}`
      : "";

  // Mother's medications active at the nappy's time — some pass into
  // breastmilk and shift stool colour (e.g. iron → darker/greener).
  const at = new Date(occurredAt).getTime();
  const activeMeds = (medEntries ?? [])
    .filter((m) => {
      const start = new Date(m.occurred_at).getTime();
      const end = m.ended_at ? new Date(m.ended_at).getTime() : Infinity;
      return start <= at && at <= end;
    })
    .map((m) => m.med_name)
    .filter(Boolean);
  const medContext = activeMeds.length
    ? `\n- Mother's medication around this time: ${activeMeds.join(", ")}. Some pass into breastmilk and can change stool — iron supplements commonly make it darker or greener. Still label the colour you actually SEE, but if a shift (e.g. green) fits a listed medication, you may note that likely cause in the summary. This never applies to pale/chalky stool or blood, which always matter regardless of medication.`
    : "";

  return `You are helping parents of a newborn track nappy contents. This is a TRACKING AID, not medical advice or diagnosis.

Context for THIS baby:
- Day of life at the time of this nappy: day ${day} (computed from the entry's own date, which may be in the past)
- Birth weight: ${baby.birth_weight_g} g
- The baby was supplemented with formula in hospital for dehydration and the family is transitioning toward full breastfeeding.
- ${feedSummary}${weightContext}${medContext}

Stool type depends on feeding, so judge against the matching pattern:
- Breastfed / expressed breastmilk (EBM counts as breastfed): mustard-yellow, seedy, quite runny.
- Formula: tan to brown, pasty (peanut-butter texture), stronger smelling.
- Mixed feeding: anywhere in between; stools trending tan → yellow-seedy over days is a GOOD sign the transition to breastfeeding is progressing — note it when you see it.
- Days 1-2: meconium (black-green, tarry) is normal regardless of feeding. Days 3-4: transitional green-brown.
- Expected for this baby today: ${expected}

Label the photo of the nappy. Your job is LABELLING and a short factual SUMMARY — colour, texture, amount, size, and whether the colour matches the feeding pattern. Do NOT give advice, verdicts, reassurance, or warnings, and never tell parents to seek help; the app derives any guidance from your labels, and the parents can overwrite every label.

For stoolAmount, estimate how much stool is visible: none, smear, small (~1-2 tablespoons), medium (~3-5 tablespoons), or large (covers most of the nappy). If the nappy was weighed (context above), sanity-check your estimate against the total contents.

For sizeVs2pCoin, estimate the size of the stool relative to a £2 coin (about 28 mm across). NCT suggests a breastfed baby's poos are often at least the size of a £2 coin. Judge from the visible spread of stool in the nappy: "smaller", "similar", "bigger", or "unclear" if no stool is visible. State the size plainly as an observation — it is not a pass/fail.

For matchesExpected, compare the stool colour you see to the "Expected for this baby today" line above and the feeding-mix patterns: "yes" if it fits, "partly" if it is in the plausible in-between range, "no" if it clearly doesn't, "unclear" if you can't tell. This is a neutral comparison, not a warning.

For summary, write one or two calm, factual sentences covering the colour, the size vs a £2 coin, and whether the colour matches the feeding pattern. Keep it neutral and non-alarming; describe, don't advise. Example tone: "A medium mustard-yellow, seedy stool, a little bigger than a £2 coin. The colour fits the mostly-breastfed pattern for day 9."

For colourKey, classify the stool into exactly ONE of:
- meconium: black to very dark green, tarry/sticky
- transitional: green-brown, changing stool of days 3-4
- yellow: mustard yellow, typical breastfed
- tan: tan/light brown, typical formula or mixed feeding
- brown: mid-to-dark brown, typical formula
- green: distinctly green
- pale: pale, white, chalky, clay or grey (RED FLAG)
- blood: visible red blood or black tarry stool after day 4 (RED FLAG)
- unclear: no stool clearly visible in the photo

LABELLING RULES:
- Choose "pale" or "blood" whenever they genuinely might apply — under-labelling those could delay care. When torn between pale and another colour, choose pale.
- Do not stretch: normal formula-type tan/brown pasty stool is tan or brown, not a concern colour.
- If the image is unclear or shows no stool, use colourKey "unclear", stoolAmount "none", sizeVs2pCoin "unclear".`;
}

/**
 * Calls the Anthropic API with the image + prompt, returns the parsed
 * analysis (with analysedAt/model stamped). Throws a plain Error whose
 * message is safe to surface to the user on failure.
 */
export async function runPhotoAnalysis(opts: {
  imageBase64: string;
  mediaType: MediaType;
  prompt: string;
}): Promise<AiAnalysis> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 1024,
      output_config: {
        format: { type: "json_schema", schema: ANALYSIS_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: opts.mediaType,
                data: opts.imageBase64,
              },
            },
            { type: "text", text: opts.prompt },
          ],
        },
      ],
    });
  } catch (e) {
    console.error("Anthropic analysis failed:", e instanceof Error ? e.message : e);
    throw new Error("Analysis is unavailable right now — try again in a moment.");
  }

  if (response.stop_reason === "refusal" || response.content.length === 0) {
    throw new Error("The photo couldn't be analysed.");
  }
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Unexpected model response.");
  }
  let ai: AiAnalysis;
  try {
    ai = JSON.parse(textBlock.text) as AiAnalysis;
  } catch {
    throw new Error("Could not parse the analysis.");
  }
  ai.analysedAt = new Date().toISOString();
  ai.model = ANALYSIS_MODEL;
  return ai;
}
