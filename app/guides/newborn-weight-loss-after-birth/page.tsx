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

const SLUG = "newborn-weight-loss-after-birth";
const g = getGuide(SLUG)!;

export const metadata: Metadata = {
  title: `${g.title} | ${APP_NAME}`,
  description: g.description,
  alternates: { canonical: `/guides/${SLUG}` },
};

export default function Page() {
  return (
    <div className="legal guide">
      <GuideJsonLd slug={SLUG} title={g.title} description={g.description} />
      <p className="text-sm font-medium text-accent">Newborn guides</p>
      <h1>{g.title}</h1>

      <p>
        Almost all babies lose a little weight in the first few days — it’s
        expected, not a warning sign. Most lose weight until around{" "}
        <strong>day 3 or 4</strong>, then start gaining, and{" "}
        <strong>most are back to their birth weight by about 3 weeks</strong>.
        A loss of up to about 7% of birth weight is considered normal.
      </p>

      <h2>Why newborns lose weight at first</h2>
      <p>
        Babies are born with extra fluid, and they pass this in their first wees
        and poos (the black, tarry meconium). In the first couple of days
        breastfed babies take small amounts of colostrum — rich but low in
        volume — before your milk “comes in” around day 3–4. So a small dip is
        simply your baby shedding fluid faster than they’re taking milk on board.
        It levels off quickly.
      </p>

      <h2>How much weight loss is normal?</h2>
      <ul>
        <li>
          <strong>Up to ~7%</strong> of birth weight: within the usual range.
          Keep feeding well and keep an eye on nappies.
        </li>
        <li>
          <strong>More than 7%:</strong> worth mentioning to your midwife the
          same day. They’ll usually watch feeding and may weigh again sooner.
        </li>
        <li>
          <strong>10% or more:</strong> needs a feeding assessment and review
          without delay — contact your midwife or doctor now. It doesn’t
          necessarily mean anything is seriously wrong, but it should be checked
          promptly.
        </li>
      </ul>
      <p className="text-sm text-muted">
        Percentages are worked out from birth weight. For example, a baby born
        at 3,500 g losing 7% would be about 3,255 g; a 10% loss would be about
        3,150 g.
      </p>

      <h2>When should they be back to birth weight?</h2>
      <p>
        The NHS guide is <strong>by about 3 weeks (day 21)</strong>. Some babies
        get there sooner, around 10–14 days; others take the full three weeks.
        After that, a rough guide for healthy gain is about{" "}
        <strong>150–200 g a week</strong> in the early months, though babies
        grow in fits and starts rather than a straight line. If your baby hasn’t
        regained birth weight by 2 weeks, your midwife or health visitor will
        keep a closer eye and support feeding.
      </p>

      <h2>How weight is tracked in the UK</h2>
      <p>
        Your baby is weighed at birth, and again around day 5 and day 10 by your
        midwife, then by your health visitor. Weights are plotted on the{" "}
        <strong>UK-WHO growth charts</strong> in your red book (the Personal
        Child Health Record). What matters is the <em>trend</em> along a centile
        line, not a single reading — and babies aren’t expected to weigh in more
        than once a week or two once feeding is established, because frequent
        weighing just adds noise and worry.
      </p>
      <p>
        Weigh on the same scales where you can, with your baby undressed, and
        remember that a full bladder, a recent feed or a big poo can shift the
        number by 100 g or more.
      </p>

      <SeekHelp>
        <p>Speak to your midwife, health visitor or GP if:</p>
        <ul>
          <li>Your baby has lost more than 10% of their birth weight.</li>
          <li>
            Weight is still dropping after day 4–5, or hasn’t started climbing.
          </li>
          <li>Your baby isn’t back to birth weight by about 2–3 weeks.</li>
          <li>
            Weight loss comes with fewer wet nappies, a very sleepy baby, or
            feeding that isn’t going well — see{" "}
            <Link href="/guides/is-my-baby-getting-enough-milk">
              is my baby getting enough milk?
            </Link>
          </li>
          <li>
            Your baby loses weight or crosses down through centile lines later
            on, after a good start.
          </li>
        </ul>
      </SeekHelp>

      <p>
        A weight “line” tells you far more than any single number, but only if
        you can see it. {APP_NAME} plots each weigh-in against the WHO centile
        for your baby’s age and sex, so you can watch the trend between health
        visitor visits instead of guessing from one reading.
      </p>

      <GuideCta />
      <RelatedGuides exclude={SLUG} />
    </div>
  );
}
