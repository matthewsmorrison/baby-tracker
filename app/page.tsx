import Link from "next/link";
import Image from "next/image";
import {
  Baby,
  Flame,
  HeartPulse,
  LineChart,
  MessageCircleQuestion,
  Moon,
  Users,
} from "lucide-react";
import { Footer } from "@/components/marketing/Footer";
import { APP_NAME } from "@/lib/legal";

export const metadata = {
  title: "Beanlo — the newborn tracker that's up with you at 3am",
  description:
    "The iPhone app for the fourth trimester: nappies, feeds, weight and sleep against real newborn guidance — plus friends who can see when you're up feeding at 3am. UK-WHO red book centiles built in. A tracking aid, not medical advice.",
};

// TestFlight public link (App Store Connect → TestFlight → External Testing
// → public link). Swap for the App Store URL once the app is released.
const APP_STORE_URL: string | null = null;

const FEATURES = [
  {
    icon: Baby,
    title: "Nappies, made sense of",
    body: "Log a nappy in one tap — from the app, the home-screen widget, Siri or the Action Button — and see counts against the day-by-day amounts newborns are expected to have.",
  },
  {
    icon: HeartPulse,
    title: "Feeds & pumping",
    body: "A breast-feed timer on your lock screen and Dynamic Island, next-feed nudges, and breast, expressed and formula in one picture.",
  },
  {
    icon: LineChart,
    title: "The red book, on your phone",
    body: "Weight, height and head circumference plotted on the same nine UK-WHO centile curves printed in your red book.",
  },
  {
    icon: Moon,
    title: "Sleep & rest",
    body: "Track the baby's sleep — and your own, because looking after yourselves matters too.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Ask your data",
    body: "Ask plain-language questions about everything you've logged and get answers grounded only in your own records.",
  },
  {
    icon: Users,
    title: "Share with your carers",
    body: "Invite a partner, family or your health visitor. Everyone caring for the baby sees the same picture, updated live.",
  },
];

const SCREENS = [
  { src: "/screens/history.png", alt: "Calendar history of feeds, nappies and weights in the Beanlo app" },
  { src: "/screens/today.png", alt: "Beanlo's Today screen: next feed due, nap window and nappy count" },
  { src: "/screens/charts.png", alt: "Feeding and nappy charts in the Beanlo app" },
];

/** The classic black App Store badge, drawn inline so it needs no assets. */
function AppStoreBadge() {
  const badge = (
    <span className="inline-flex items-center gap-3 rounded-xl bg-black px-5 py-2.5 text-white shadow-sm transition hover:opacity-85 dark:ring-1 dark:ring-white/25">
      <svg viewBox="0 0 384 512" aria-hidden className="h-8 w-8 fill-current">
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
      </svg>
      <span className="text-left leading-tight">
        <span className="block text-[11px] font-medium opacity-80">
          {APP_STORE_URL ? "Download on the" : "Coming soon to the"}
        </span>
        <span className="block text-xl font-semibold tracking-tight">App Store</span>
      </span>
    </span>
  );
  return APP_STORE_URL ? (
    <a href={APP_STORE_URL} aria-label="Download Beanlo on the App Store">
      {badge}
    </a>
  ) : (
    badge
  );
}

export default function Landing() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft">
            <Flame className="h-5 w-5 text-accent" strokeWidth={2.2} />
          </span>
          <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
        </div>
        <Link
          href="/guides"
          className="rounded-full px-3 py-2 text-sm font-medium text-muted hover:text-ink"
        >
          Guides
        </Link>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden px-6 pb-10 pt-10 text-center sm:pt-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 55% 55% at 50% 0%, var(--bg-glow), transparent 62%)",
            }}
          />
          <div className="relative mx-auto max-w-2xl">
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              The newborn tracker that&rsquo;s up with you at 3am
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
              {APP_NAME} for iPhone keeps nappies, feeds, weight and sleep
              against real newborn guidance — the same UK-WHO centiles as your
              red book — and shows you which of your friends are up feeding
              too, so the night shift feels less alone.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <AppStoreBadge />
              <a
                href="#features"
                className="rounded-full border border-line bg-surface px-6 py-3 text-base font-medium hover:border-ink"
              >
                See what it does
              </a>
            </div>
            <p className="mt-4 text-xs text-faint">
              Free to start. A tracking aid — not medical advice.
            </p>
          </div>
        </section>

        {/* App screenshots */}
        <section className="overflow-hidden px-6 pb-4 pt-6">
          <div className="mx-auto flex max-w-3xl items-end justify-center gap-4 sm:gap-6">
            {SCREENS.map((s, i) => (
              <div
                key={s.src}
                className={`w-[30%] shrink-0 overflow-hidden rounded-[1.6rem] border border-line bg-surface shadow-xl sm:rounded-[2.2rem] ${
                  i === 1 ? "z-10 -mb-2 w-[36%]" : "opacity-95"
                }`}
              >
                <Image
                  src={s.src}
                  alt={s.alt}
                  width={598}
                  height={1300}
                  priority={i === 1}
                  className="h-auto w-full"
                />
              </div>
            ))}
          </div>
        </section>

        {/* 3am club */}
        <section className="px-6 py-12">
          <div className="mx-auto max-w-2xl rounded-3xl bg-ink p-8 text-center text-on-ink">
            <h2 className="text-2xl font-bold">The 3am club</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed opacity-85">
              Add the friends from your antenatal group and see when they&rsquo;re
              up feeding too — a status line, a wave, a private message. Every
              message is end-to-end encrypted; nobody but the two of you can
              read it, including us. It turns out 3am is a lot more bearable
              with company.
            </p>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-4xl px-6 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-3xl border border-line bg-surface p-6"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Reassurance / safety */}
        <section className="mx-auto max-w-2xl px-6 py-10">
          <div className="rounded-3xl border border-line bg-surface-alt p-7 text-center">
            <h2 className="text-xl font-bold">Built to help, never to alarm</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted">
              {APP_NAME} is a tracking aid, not a medical device. It doesn&rsquo;t
              diagnose and never gives an all-clear that could delay care. It
              flags the things worth checking — like pale stools or blood — and
              always points you to your midwife, health visitor or doctor for
              anything that concerns you. Your data is private to you and the
              carers you invite.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
              <Link
                href="/disclaimer"
                className="font-medium text-muted underline underline-offset-4 hover:text-ink"
              >
                Read the medical disclaimer
              </Link>
              <Link
                href="/privacy"
                className="font-medium text-muted underline underline-offset-4 hover:text-ink"
              >
                How your data is handled
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 pb-16 text-center">
          <AppStoreBadge />
        </section>
      </main>

      <Footer />
    </div>
  );
}
