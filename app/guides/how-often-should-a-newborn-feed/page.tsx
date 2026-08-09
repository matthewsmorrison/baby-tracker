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

const SLUG = "how-often-should-a-newborn-feed";
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
        Newborns feed a lot. In the early weeks, expect{" "}
        <strong>at least 8 to 12 feeds in every 24 hours</strong> — roughly
        every 2 to 3 hours, though never as tidily as that sounds. Feeding
        little and often is normal and healthy: a newborn’s stomach is tiny, and
        frequent feeds are what build up your milk supply.
      </p>

      <h2>How often, in the first days and weeks</h2>
      <ul>
        <li>
          <strong>First 24–48 hours:</strong> some babies are sleepy after
          birth. Aim to feed at least 8 times in 24 hours, waking your baby if
          needed — offer a feed if more than about 3 hours have passed in the
          day, or 4 hours overnight.
        </li>
        <li>
          <strong>First few weeks:</strong> 8–12 feeds a day, on your baby’s
          cues. Breastfed babies usually feed more often than formula-fed babies
          because breastmilk is digested quickly.
        </li>
        <li>
          <strong>Overnight:</strong> night feeds matter. The hormone that makes
          milk is highest at night, so feeding in the small hours protects your
          supply. Waking to feed is expected, not a problem to fix.
        </li>
      </ul>

      <h2>Feed on cues, not the clock</h2>
      <p>
        Responsive (baby-led) feeding means watching your baby rather than a
        timer. Early hunger cues include stirring, turning the head and opening
        the mouth (“rooting”), bringing hands to the mouth, and sucking. Crying
        is a <em>late</em> hunger cue — it’s easier to feed a baby who hasn’t
        got upset yet. You can’t overfeed a breastfed baby by feeding
        responsively, and feeding is also how babies comfort themselves, not
        just how they take milk.
      </p>

      <h2>What is cluster feeding?</h2>
      <p>
        Some evenings your baby will want to feed almost constantly for a few
        hours — on, off, on again. This is <strong>cluster feeding</strong>, and
        it’s completely normal, especially in the evenings and during growth
        spurts (often around 3 weeks, 6 weeks and 3 months). It’s not a sign
        you’re running low on milk; it’s how babies boost supply and settle for
        a longer sleep. Exhausting, but normal — line up snacks, drinks and a
        boxset.
      </p>

      <h2>How long should a feed take?</h2>
      <p>
        There’s no fixed number. Some breastfed babies finish in 10 minutes,
        others take 40. Let your baby finish the first breast (you’ll notice the
        deep, rhythmic “sucking and swallowing” slow down) before offering the
        second. What matters more than the clock is that your baby is feeding
        effectively — which shows up in nappies and weight, not minutes. See{" "}
        <Link href="/guides/is-my-baby-getting-enough-milk">
          is my baby getting enough milk?
        </Link>
      </p>

      <h2>Formula and mixed feeding</h2>
      <p>
        If you’re formula feeding, you can still feed responsively — offer the
        bottle in response to cues and let your baby stop when they’ve had
        enough, rather than pushing them to finish every bottle. As a rough
        guide, formula-fed newborns take smaller, more frequent feeds at first,
        settling towards roughly 150–200 ml per kg of body weight per day over
        24 hours in the early weeks. Your health visitor can help you check the
        amounts are about right.
      </p>

      <SeekHelp>
        <p>Contact your midwife, health visitor or GP if:</p>
        <ul>
          <li>
            Your baby is feeding fewer than 8 times in 24 hours, or is too
            sleepy to wake for feeds.
          </li>
          <li>Your baby is consistently refusing feeds.</li>
          <li>
            Feeding is painful, or you’re worried your baby isn’t latching or
            getting enough — ask for a face-to-face feeding assessment.
          </li>
          <li>
            Wet and dirty nappies drop below what’s expected for the day (see
            our{" "}
            <Link href="/guides/wet-and-dirty-nappies-newborn">
              nappy guide
            </Link>
            ), or your baby seems unusually floppy or hard to rouse.
          </li>
        </ul>
      </SeekHelp>

      <p>
        In a sleep-deprived haze, “when did we last feed?” is a genuinely hard
        question — especially at 4am, or when you’re handing over to a partner.
        {" "}
        {APP_NAME} keeps a running feed log and tells you how long it’s been, so
        you’re not doing mental arithmetic in the dark.
      </p>

      <GuideCta />
      <RelatedGuides exclude={SLUG} />
    </div>
  );
}
