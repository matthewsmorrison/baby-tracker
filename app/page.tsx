import Link from "next/link";
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
  title: "beanlo — a gentle newborn tracker for the first weeks",
  description:
    "Track nappies, feeds, weight and sleep in the fourth trimester. Photo-labelled nappies, expected ranges from established newborn guidance, and sharing with everyone caring for your baby. A tracking aid, not medical advice.",
};

const FEATURES = [
  {
    icon: Baby,
    title: "Nappies, made sense of",
    body: "Log wet and dirty nappies against the day-by-day amounts newborns are expected to have, so you can see at a glance whether things are on track.",
  },
  {
    icon: HeartPulse,
    title: "Feeds & pumping",
    body: "Breast, expressed and formula in one place, with the next feed due and how output changes through the day.",
  },
  {
    icon: LineChart,
    title: "Weight vs expected",
    body: "Plot weight against the expected range for each day of life — the reassuring upward turn back to birth weight, shown clearly.",
  },
  {
    icon: Moon,
    title: "Sleep & rest",
    body: "Track the baby’s sleep — and your own, because looking after yourselves matters too.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Ask your data",
    body: "Ask plain-language questions about everything you’ve logged and get answers grounded only in your own records.",
  },
  {
    icon: Users,
    title: "Share with your carers",
    body: "Invite a partner, family or your health visitor. Everyone caring for the baby sees the same picture.",
  },
];

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
        <div className="flex items-center gap-2">
          <Link
            href="/for-professionals"
            className="hidden rounded-full px-3 py-2 text-sm font-medium text-muted hover:text-ink sm:inline"
          >
            For professionals
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-ink"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden px-6 pb-16 pt-10 text-center sm:pt-16">
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
              A gentle tracker for the first days and weeks
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
              {APP_NAME} helps you keep an eye on nappies, feeds, weight and
              sleep in the fourth trimester — with expected ranges from
              established newborn guidance, so you know what’s normal and when
              to ask for help.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/login"
                className="w-full rounded-full bg-ink px-6 py-3 text-base font-semibold text-on-ink hover:opacity-90 sm:w-auto"
              >
                Get started
              </Link>
              <a
                href="#features"
                className="w-full rounded-full border border-line bg-surface px-6 py-3 text-base font-medium hover:border-ink sm:w-auto"
              >
                See what it does
              </a>
            </div>
            <p className="mt-4 text-xs text-faint">
              Free to start. A tracking aid — not medical advice.
            </p>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-4xl px-6 py-8">
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
              {APP_NAME} is a tracking aid, not a medical device. It doesn’t
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
          <Link
            href="/login"
            className="inline-block rounded-full bg-ink px-7 py-3 text-base font-semibold text-on-ink hover:opacity-90"
          >
            Start tracking
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
