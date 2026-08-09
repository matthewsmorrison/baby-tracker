import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/legal";
import { getGuide } from "@/lib/guides";
import {
  GuideCta,
  GuideJsonLd,
  RelatedGuides,
  SeekHelp,
} from "@/components/marketing/GuideBits";

const SLUG = "baby-poo-colour-chart";
const g = getGuide(SLUG)!;

export const metadata: Metadata = {
  title: `${g.title} | ${APP_NAME}`,
  description: g.description,
  alternates: { canonical: `/guides/${SLUG}` },
};

interface Row {
  swatch: string;
  colour: string;
  meaning: string;
  warn?: boolean;
}
const ROWS: Row[] = [
  {
    swatch: "#2E2E28",
    colour: "Black / dark green, sticky (meconium)",
    meaning:
      "Normal in the first 1–2 days. This is meconium — tar-like and hard to wipe. It should clear by day 3–4.",
  },
  {
    swatch: "#6E5A34",
    colour: "Green-brown, looser (changing stool)",
    meaning:
      "Normal around day 3–4 as your milk comes in and meconium clears.",
  },
  {
    swatch: "#E3B44A",
    colour: "Mustard yellow, seedy, runny",
    meaning:
      "The classic breastfed poo from about day 5. Often loose and frequent — not diarrhoea.",
  },
  {
    swatch: "#BFA173",
    colour: "Tan / pale brown, pasty",
    meaning:
      "Normal for formula-fed or mixed-fed babies — firmer and stronger smelling than breastfed poo.",
  },
  {
    swatch: "#5C7A3A",
    colour: "Green",
    meaning:
      "Usually harmless — can follow a lot of foremilk, a tummy bug, or iron in formula. Worth watching if it’s frequent, frothy and your baby is unsettled.",
  },
  {
    swatch: "#ECE7D6",
    colour: "Pale, white or chalky",
    meaning:
      "Not normal at any age. Can signal a liver problem — contact your GP or midwife the same day.",
    warn: true,
  },
  {
    swatch: "#9E3B32",
    colour: "Red (blood) or black after day 4",
    meaning:
      "Blood in poo, or black poo once meconium has cleared, needs same-day medical advice.",
    warn: true,
  },
];

export default function Page() {
  return (
    <div className="legal guide">
      <GuideJsonLd slug={SLUG} title={g.title} description={g.description} />
      <p className="text-sm font-medium text-accent">Newborn guides</p>
      <h1>{g.title}</h1>

      <p>
        Baby poo changes colour a lot in the first weeks, and almost all of it
        is normal. It runs from black meconium at birth, through green
        “changing” stools, to mustard-yellow (breastfed) or tan (formula). Only
        two colours always need checking: <strong>pale/chalky</strong> and{" "}
        <strong>red or black (blood)</strong>.
      </p>

      <h2>Baby poo colour chart</h2>
      <div className="my-6 space-y-2">
        {ROWS.map((r) => (
          <div
            key={r.colour}
            className={`flex gap-3 rounded-2xl border p-4 ${
              r.warn ? "border-alert/40 bg-alert-bg/50" : "border-line bg-surface-alt"
            }`}
          >
            <span
              aria-hidden
              className="mt-0.5 h-6 w-6 shrink-0 rounded-full border border-line"
              style={{ backgroundColor: r.swatch }}
            />
            <span className="text-sm">
              <span className="block font-semibold text-ink">{r.colour}</span>
              <span className="mt-0.5 block text-muted">{r.meaning}</span>
            </span>
          </div>
        ))}
      </div>

      <h2>Green poo in a breastfed baby</h2>
      <p>
        Occasional green poo is common and usually nothing to worry about. It can
        happen after a cold or tummy bug, when your baby is teething later on, or
        sometimes when they’re taking lots of quick, watery foremilk and less of
        the richer hindmilk. If green, frothy poos are frequent and your baby is
        unsettled or not gaining well, it’s worth a feeding check — but a green
        nappy here and there in a happy, thriving baby isn’t a problem.
      </p>

      <h2>How often, and how runny?</h2>
      <p>
        Breastfed newborns often poo at almost every feed, and the poo is
        typically loose and seedy — that’s normal, not diarrhoea. Formula-fed
        babies tend to go less often with firmer, paler poo. After 6 weeks or
        so, some breastfed babies go days between poos, which can be fine if the
        poo stays soft and your baby is comfortable and feeding well. For what to
        expect day by day, see our{" "}
        <Link href="/guides/wet-and-dirty-nappies-newborn">
          wet and dirty nappies guide
        </Link>
        .
      </p>

      <SeekHelp>
        <p>Contact your GP, midwife or health visitor the same day if you see:</p>
        <ul>
          <li>
            <strong>Pale, white or chalky poo</strong> — at any age. Compare
            against a stool colour card if your area provides one.
          </li>
          <li>
            <strong>Blood in the poo</strong> (red streaks or specks), or poo
            that is <strong>black</strong> after day 4 once meconium has gone.
          </li>
          <li>
            <strong>Watery diarrhoea</strong> that keeps coming, especially with
            fewer wet nappies, a fever, vomiting, or signs of dehydration.
          </li>
          <li>A hard, dry, pellet-like poo, or a baby who seems in pain to go.</li>
        </ul>
        <p className="mt-2">
          Trust your instincts — if your baby also seems unwell, floppy or won’t
          feed, seek advice urgently or call NHS 111.
        </p>
      </SeekHelp>

      <p>
        Snapping a photo and logging the colour each time means you (and your
        health visitor) can see what’s normal for your baby and spot a real
        change fast. {APP_NAME} lets you log nappy colour in a tap and flags the
        colours that need attention.
      </p>

      <GuideCta />
      <RelatedGuides exclude={SLUG} />
    </div>
  );
}
