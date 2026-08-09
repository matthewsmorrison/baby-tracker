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

const SLUG = "is-my-baby-getting-enough-milk";
const g = getGuide(SLUG)!;

export const metadata: Metadata = {
  title: `${g.title} 7 reassuring signs | ${APP_NAME}`,
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
        It’s the question that keeps new parents awake, because you can’t see how
        much a breastfed baby takes. The good news: you don’t need to. Your baby
        gives you reliable signals instead — mostly at the other end. Here are
        the signs that feeding is going well.
      </p>

      <h2>7 signs your baby is getting enough milk</h2>
      <ul>
        <li>
          <strong>Plenty of wet nappies.</strong> After day 5, at least 6 heavy,
          pale-wet nappies in 24 hours. This is the single most reassuring sign.
          See the day-by-day counts in our{" "}
          <Link href="/guides/wet-and-dirty-nappies-newborn">nappy guide</Link>.
        </li>
        <li>
          <strong>Regular, soft yellow poos.</strong> At least two poos a day,
          bigger than a £2 coin, in the early weeks — yellow and seedy for
          breastfed babies once your milk is in.
        </li>
        <li>
          <strong>Active, rhythmic sucking with swallowing.</strong> You’ll see
          deep jaw movements and hear or see swallowing during a feed — not just
          fluttery sucks. Your baby comes off the breast looking relaxed.
        </li>
        <li>
          <strong>Feeding often.</strong> At least 8 feeds in 24 hours (see{" "}
          <Link href="/guides/how-often-should-a-newborn-feed">
            how often should a newborn feed?
          </Link>
          ). Frequent feeding is normal, not a sign of failure.
        </li>
        <li>
          <strong>Content between many feeds.</strong> Some fussy periods and
          cluster feeding are normal, but your baby has calm, settled spells too
          and isn’t frantic around the clock.
        </li>
        <li>
          <strong>Healthy colour and good tone.</strong> Your baby wakes for
          feeds, has bright eyes, moist lips and a strong grip — not floppy or
          persistently hard to rouse.
        </li>
        <li>
          <strong>Weight tracking as expected.</strong> A little loss in the
          first days is normal; most babies are back to birth weight by about 3
          weeks, then gain steadily. See{" "}
          <Link href="/guides/newborn-weight-loss-after-birth">
            newborn weight loss after birth
          </Link>
          .
        </li>
      </ul>

      <h2>Signs that are NOT reliable</h2>
      <p>
        Some things worry parents but tell you very little on their own:
      </p>
      <ul>
        <li>
          <strong>How long a feed lasts</strong> — effective feeders vary hugely.
        </li>
        <li>
          <strong>Whether your breasts feel full</strong> — after a few weeks
          they soften as supply settles to demand. Soft breasts don’t mean empty.
        </li>
        <li>
          <strong>Feeding frequently or cluster feeding</strong> — normal
          newborn behaviour, not proof of low supply.
        </li>
        <li>
          <strong>Whether your baby takes a bottle after a breastfeed</strong> —
          babies will often take a little more even when they’ve had enough.
        </li>
      </ul>

      <h2>The one number worth watching</h2>
      <p>
        If you want a single objective check, it’s wet nappies plus weight
        together. Nappies show what’s going in day to day; weight, plotted on
        the UK-WHO charts in your red book, shows the trend over weeks. If both
        look right, feeding is almost certainly going well — regardless of how
        the feeds “feel”.
      </p>

      <SeekHelp>
        <p>
          Ask for a feeding assessment from your midwife, health visitor, or a
          breastfeeding specialist if:
        </p>
        <ul>
          <li>Wet or dirty nappies drop below the day-by-day guide.</li>
          <li>
            Your baby is very sleepy, difficult to wake for feeds, or feeds seem
            frantic and never satisfying.
          </li>
          <li>
            Your baby hasn’t regained birth weight by about 2–3 weeks, or has
            lost more than 10% of birth weight.
          </li>
          <li>
            Feeding hurts, or you can’t hear or see any swallowing during feeds.
          </li>
          <li>
            There are signs of dehydration: far fewer wet nappies, dark urine, a
            dry mouth, or a sunken soft spot on the head.
          </li>
        </ul>
        <p className="mt-2">
          You can also call the National Breastfeeding Helpline on 0300 100 0212.
          Low supply is much less common than it feels, and most feeding
          problems are very fixable with the right support.
        </p>
      </SeekHelp>

      <p>
        The reassurance is in the pattern, and the pattern is hard to hold in
        your head at 3am. {APP_NAME} logs feeds, nappies and weight together and
        shows you the trend — so “is she getting enough?” has an answer you can
        actually look at.
      </p>

      <GuideCta />
      <RelatedGuides exclude={SLUG} />
    </div>
  );
}
