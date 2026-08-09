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

const SLUG = "wet-and-dirty-nappies-newborn";
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
        In the first week, nappies are the clearest sign your baby is feeding
        well. The rough rule: <strong>one wet nappy for each day of life</strong>{" "}
        until about day 5 or 6, then at least 6 heavy wet nappies a day — plus
        regular dirty nappies that change colour as your milk comes in. Here is
        the day-by-day picture the NHS and NCT use.
      </p>

      <h2>Wet and dirty nappies, day by day</h2>
      <div className="my-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-2 pr-4 font-semibold">Baby’s age</th>
              <th className="py-2 pr-4 font-semibold">Wet nappies (24h)</th>
              <th className="py-2 font-semibold">Dirty nappies (24h)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line/60">
              <td className="py-2 pr-4">Day 1–2</td>
              <td className="py-2 pr-4">2 or more</td>
              <td className="py-2">1 or more — black, tarry meconium</td>
            </tr>
            <tr className="border-b border-line/60">
              <td className="py-2 pr-4">Day 3–4</td>
              <td className="py-2 pr-4">3 or more, heavier</td>
              <td className="py-2">2 or more — greener, at least £2-coin sized</td>
            </tr>
            <tr className="border-b border-line/60">
              <td className="py-2 pr-4">Day 5–6</td>
              <td className="py-2 pr-4">5 or more, heavy</td>
              <td className="py-2">2 or more — soft yellow, ≥ £2 coin</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">Day 7 onwards</td>
              <td className="py-2 pr-4">6 or more, heavy</td>
              <td className="py-2">
                At least 2 good yellow poos, bigger than a £2 coin
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">
        These are minimums, not targets — more dirty nappies than the minimum is
        completely normal, especially for breastfed babies. Disposable nappies
        are very absorbent, so “heavy” matters more than counting drips.
      </p>

      <h2>What a “wet enough” nappy feels like</h2>
      <p>
        Modern nappies hide wee well. A useful test: a wet nappy should feel as
        heavy as if you’d poured 2–3 tablespoons of water onto a dry one. If
        you’re not sure, pop a little cotton wool in the nappy — you’ll see it’s
        damp. Urine should be pale and mild-smelling. Dark, strong-smelling urine
        after day 3–4 is a sign to get feeding checked.
      </p>
      <p>
        In the first day or two you may spot a patch of pinkish-orange “brick
        dust” in the nappy — these are urate crystals and are usually harmless
        early on. If they carry on past day 3, mention it to your midwife, as it
        can mean baby needs more milk.
      </p>

      <h2>What the poo should be doing</h2>
      <p>
        Poo tells its own story in the first week. It starts as{" "}
        <strong>meconium</strong> — black-green, sticky and tar-like — then turns
        greener and looser (“changing stools”) around day 3–4 as your milk comes
        in, and settles into soft yellow by day 5 or so. Breastfed babies often
        do a small poo at almost every feed; formula-fed babies tend to go less
        often and their poo is more paste-like and stronger smelling. Both are
        fine. For the full colour picture, see our{" "}
        <Link href="/guides/baby-poo-colour-chart">baby poo colour chart</Link>.
      </p>

      <h2>After the first few weeks</h2>
      <p>
        Once breastfeeding is well established (usually after 6 weeks or so),
        some breastfed babies poo much less often — even once every few days —
        and that can be normal as long as the poo is still soft and your baby is
        comfortable, feeding well and gaining weight. Wet nappies should stay
        frequent throughout.
      </p>

      <SeekHelp>
        <p>Speak to your midwife, health visitor or GP the same day if:</p>
        <ul>
          <li>
            Your baby has fewer wet nappies than the day-by-day guide above, or
            wees become dark and strong-smelling after day 3–4.
          </li>
          <li>
            You still see black, tarry meconium on day 5 or later (poo should
            have turned yellow by then).
          </li>
          <li>There is any blood in the nappy, in either wee or poo.</li>
          <li>
            The poo is pale, white or chalky — this always needs checking.
          </li>
          <li>
            Your baby is very sleepy, hard to wake for feeds, or seems dry
            (sunken soft spot, no tears, dry mouth).
          </li>
        </ul>
      </SeekHelp>

      <p>
        Counting nappies in your head all day is exhausting, especially when
        two people are sharing the care. That’s exactly what {APP_NAME} is for:
        tap each nappy as it happens and it shows how today compares with what’s
        normal for your baby’s age.
      </p>

      <GuideCta />
      <RelatedGuides exclude={SLUG} />
    </div>
  );
}
