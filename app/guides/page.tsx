import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { APP_NAME } from "@/lib/legal";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = {
  title: `Newborn guides — nappies, feeding, weight & poo | ${APP_NAME}`,
  description:
    "Plain, NHS-grounded guides for the first weeks: how many nappies a newborn should have, how often to feed, whether baby is getting enough milk, normal weight loss, and a baby poo colour chart.",
  alternates: { canonical: "/guides" },
};

export default function GuidesIndex() {
  return (
    <div className="legal guide">
      <p className="text-sm font-medium text-accent">Newborn guides</p>
      <h1>The first weeks, explained simply</h1>
      <p>
        Short, calm, evidence-based guides to the questions almost every new
        parent Googles at 3am — grounded in NHS, NCT and WHO guidance. Each one
        tells you what’s normal, what to keep an eye on, and when to get help.
        They’re a tracking aid, not medical advice.
      </p>

      <div className="mt-8 space-y-3">
        {GUIDES.map((g) => (
          <Link
            key={g.slug}
            href={`/guides/${g.slug}`}
            className="group flex items-start justify-between gap-4 rounded-2xl border border-line bg-surface-alt p-5 no-underline transition hover:border-accent"
          >
            <span>
              <span className="block font-semibold text-ink">{g.title}</span>
              <span className="mt-1 block text-sm text-muted">{g.blurb}</span>
            </span>
            <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted transition group-hover:text-accent" />
          </Link>
        ))}
      </div>
    </div>
  );
}
