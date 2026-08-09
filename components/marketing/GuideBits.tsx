import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { APP_NAME, WEBSITE } from "@/lib/legal";
import { GUIDES } from "@/lib/guides";

/** Article structured data for richer search results. */
export function GuideJsonLd({
  slug,
  title,
  description,
}: {
  slug: string;
  title: string;
  description: string;
}) {
  const json = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    inLanguage: "en-GB",
    isAccessibleForFree: true,
    mainEntityOfPage: `https://${WEBSITE}/guides/${slug}`,
    author: { "@type": "Organization", name: APP_NAME },
    publisher: { "@type": "Organization", name: APP_NAME },
  };
  return (
    <script
      type="application/ld+json"
      // JSON.stringify doesn't escape "</script>"; escape "<" so nothing in
      // the JSON can ever close the tag and inject markup.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(json).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/** Call-to-action shown at the foot of each guide. */
export function GuideCta() {
  return (
    <div className="my-8 rounded-3xl border border-line bg-surface-alt p-6 text-center">
      <p className="font-semibold">Track it, don’t carry it in your head</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        {APP_NAME} logs nappies, feeds, weight and sleep and shows you what’s
        normal for each day — free, and shareable with your partner or health
        visitor.
      </p>
      <Link
        href="/login"
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-on-ink hover:opacity-90"
      >
        Start tracking free <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

/** "When to get help" red-flag box — appears in every clinical guide. */
export function SeekHelp({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 rounded-2xl border border-alert/30 bg-alert-bg/60 p-5">
      <p className="flex items-center gap-2 font-semibold text-alert">
        <AlertTriangle className="h-4 w-4" />
        When to get help
      </p>
      <div className="mt-2 text-sm [&>ul]:mt-1 [&>ul]:list-disc [&>ul]:pl-5 [&>ul>li]:my-1">
        {children}
      </div>
      <p className="mt-3 text-xs text-muted">
        If you’re worried, contact your midwife, health visitor or GP, or call
        NHS 111. In an emergency call 999. Trust your instincts.
      </p>
    </div>
  );
}

/** Cross-links to the other guides. */
export function RelatedGuides({ exclude }: { exclude: string }) {
  const others = GUIDES.filter((g) => g.slug !== exclude).slice(0, 3);
  return (
    <div className="mt-10 border-t border-line pt-6">
      <p className="text-sm font-semibold">Related guides</p>
      <ul className="mt-2 space-y-1.5">
        {others.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/guides/${g.slug}`}
              className="text-sm text-muted underline underline-offset-4 hover:text-ink"
            >
              {g.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
