// Index of the SEO guides. Keep titles/descriptions tuned for search intent;
// each has its own page under app/guides/<slug>.
export interface GuideMeta {
  slug: string;
  title: string; // <title> / H1
  description: string; // meta description (~150 chars)
  blurb: string; // shown on the index card
}

export const GUIDES: GuideMeta[] = [
  {
    slug: "wet-and-dirty-nappies-newborn",
    title: "How many wet and dirty nappies should a newborn have?",
    description:
      "A day-by-day guide to how many wet and dirty nappies a newborn should have in the first week and beyond, based on NHS and NCT guidance.",
    blurb:
      "The day-by-day nappy count that tells you feeding is going well — and when to check with your midwife.",
  },
  {
    slug: "how-often-should-a-newborn-feed",
    title: "How often should a newborn feed?",
    description:
      "How often newborns feed in the first days and weeks, why 8–12 feeds in 24 hours is normal, and how to feed responsively.",
    blurb:
      "Why 8–12 feeds a day is normal, what cluster feeding is, and how to feed on cues rather than the clock.",
  },
  {
    slug: "is-my-baby-getting-enough-milk",
    title: "Is my breastfed baby getting enough milk?",
    description:
      "The reassuring signs a breastfed baby is getting enough milk — nappies, weight, feeding and behaviour — and the signs to act on.",
    blurb:
      "The signs that reassure you feeding is going well — nappies, weight and behaviour — and the ones to act on.",
  },
  {
    slug: "newborn-weight-loss-after-birth",
    title: "Newborn weight loss after birth: what's normal?",
    description:
      "Why newborns lose weight in the first days, how much is normal, and when they should be back to birth weight (usually by 3 weeks).",
    blurb:
      "Why babies lose weight at first, how much is normal, and when they should be back to birth weight.",
  },
  {
    slug: "baby-poo-colour-chart",
    title: "Baby poo colour chart: what's normal and what's not",
    description:
      "A baby poo colour guide — from meconium to mustard-yellow — what each colour means, and which colours need same-day medical advice.",
    blurb:
      "From black meconium to mustard-yellow: what each colour means, and the two colours that always need checking.",
  },
];

export function getGuide(slug: string): GuideMeta | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
