import Link from "next/link";
import Image from "next/image";
import {
  Baby,
  BellRing,
  Flame,
  HeartPulse,
  LineChart,
  Lock,
  MessageCircleQuestion,
  Moon,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { Footer } from "@/components/marketing/Footer";
import { APP_NAME, APP_STORE_URL } from "@/lib/legal";

export const metadata = {
  title: "Beanlo — the newborn tracker that's up with you at 3am",
  description:
    "The iPhone app for the fourth trimester: nappies, feeds, weight and sleep against real newborn guidance — plus friends who can see when you're up feeding at 3am. UK-WHO red book centiles built in. A tracking aid, not medical advice.",
};

const FEATURES = [
  {
    icon: Baby,
    title: "Nappies, made sense of",
    body: "Counts against the day-by-day amounts newborns are expected to have, stool colours explained, and photos kept with the entry for your records.",
  },
  {
    icon: HeartPulse,
    title: "Feeds & pumping",
    body: "A breast-feed timer on your lock screen and Dynamic Island, next-feed nudges, and breast, expressed and formula in one picture.",
  },
  {
    icon: LineChart,
    title: "The red book, on your phone",
    body: "Weight, height and head circumference on the same nine UK-WHO centile curves printed in your red book.",
  },
  {
    icon: Moon,
    title: "Sleep & rest",
    body: "Nap-window suggestions from your baby's own rhythm — and your sleep too, because looking after yourselves matters.",
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

const FAQS = [
  {
    q: "Is it free?",
    a: "Yes — tracking, charts, sharing with carers and friends are free. Bea, the AI assistant, is part of the advanced membership.",
  },
  {
    q: "Is my data private?",
    a: "Your baby's data is visible only to you and the carers you invite. Messages between friends are end-to-end encrypted — nobody else can read them, including us. You can export everything or delete your account (and all of its data) at any time.",
  },
  {
    q: "Is this medical advice?",
    a: "No. Beanlo is a tracking aid, not a medical device — it never diagnoses and never gives an all-clear. For anything that concerns you, speak to your midwife, health visitor or GP.",
  },
  {
    q: "What about Android or the web?",
    a: "Beanlo runs in any browser at beanlo.com — Android users can add it to their home screen. The iPhone app adds widgets, Siri, the lock-screen feed timer and native notifications.",
  },
];

/** The classic black App Store badge, drawn inline so it needs no assets. */
function AppStoreBadge() {
  const badge = (
    <span className="inline-flex items-center gap-3 rounded-xl bg-black px-5 py-2.5 text-white shadow-lg transition hover:scale-[1.03] hover:opacity-90 dark:ring-1 dark:ring-white/25">
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

function PresenceRow({
  initials,
  name,
  status,
  dot,
  ring,
}: {
  initials: string;
  name: string;
  status: string;
  dot: string;
  ring?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xs font-bold">
        {initials}
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#221d16] ${dot} ${
            ring ? "pulse-dot" : ""
          }`}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{name}</span>
        <span className="block truncate text-xs opacity-70">{status}</span>
      </span>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Gentle motion, switched off for reduced-motion users. */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes beanlo-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
          @keyframes beanlo-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
          .floaty { animation: beanlo-float 7s ease-in-out infinite }
          .floaty-late { animation: beanlo-float 7s ease-in-out 1.4s infinite }
          .pulse-dot { animation: beanlo-pulse 2.4s ease-in-out infinite }
        }
      `}</style>

      {/* Sticky glass header */}
      <header className="sticky top-0 z-40 border-b border-line/60 bg-[var(--surface,#fff)]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft">
              <Flame className="h-5 w-5 text-accent" strokeWidth={2.2} />
            </span>
            <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
          </div>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a
              href="#features"
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-muted hover:text-ink sm:inline"
            >
              Features
            </a>
            <Link
              href="/guides"
              className="rounded-full px-3 py-2 text-sm font-medium text-muted hover:text-ink"
            >
              Guides
            </Link>
            <a
              href={APP_STORE_URL ?? "#download"}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-on-ink hover:opacity-90"
            >
              Get the app
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden px-6 pb-6 pt-14 text-center sm:pt-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 55% at 50% 0%, var(--bg-glow), transparent 62%)",
            }}
          />
          <div className="relative mx-auto max-w-3xl">
            <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold text-muted">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Built for the fourth trimester, on UK newborn guidance
            </p>
            <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              The newborn tracker that&rsquo;s{" "}
              <span className="text-accent">up with you at 3am</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted">
              Nappies, feeds, weight and sleep against what&rsquo;s actually
              normal for each day of life — on the same UK-WHO centiles as your
              red book. And when you&rsquo;re up feeding in the dark, {APP_NAME}{" "}
              shows you which of your friends are up too.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <AppStoreBadge />
              <a
                href="#features"
                className="rounded-full border border-line bg-surface px-6 py-3 text-base font-medium hover:border-ink"
              >
                See what it does
              </a>
            </div>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-faint">
              <span className="inline-flex items-center gap-1.5">
                <LineChart className="h-3.5 w-3.5" /> UK-WHO red book centiles
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> End-to-end encrypted messages
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" /> Log a nappy in one tap
              </span>
            </div>
          </div>
        </section>

        {/* Phone trio */}
        <section className="relative overflow-hidden px-6 pb-6 pt-10">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
            style={{ background: "var(--bg-glow)" }}
          />
          <div className="relative mx-auto flex max-w-3xl items-end justify-center gap-4 sm:gap-7">
            <div className="floaty w-[30%] shrink-0 overflow-hidden rounded-[1.6rem] border border-line bg-surface shadow-xl sm:rounded-[2.2rem]">
              <Image
                src="/screens/history.png"
                alt="Calendar history of feeds, nappies and weights in the Beanlo app"
                width={598}
                height={1300}
                className="h-auto w-full"
              />
            </div>
            <div className="z-10 -mb-3 w-[38%] shrink-0 overflow-hidden rounded-[1.8rem] border border-line bg-surface shadow-2xl sm:rounded-[2.6rem]">
              <Image
                src="/screens/today.png"
                alt="Beanlo's Today screen: next feed due, nap window and nappy count"
                width={598}
                height={1300}
                priority
                className="h-auto w-full"
              />
            </div>
            <div className="floaty-late w-[30%] shrink-0 overflow-hidden rounded-[1.6rem] border border-line bg-surface shadow-xl sm:rounded-[2.2rem]">
              <Image
                src="/screens/charts.png"
                alt="Feeding and nappy charts in the Beanlo app"
                width={598}
                height={1300}
                className="h-auto w-full"
              />
            </div>
          </div>
        </section>

        {/* Showcase: red book */}
        <section className="mx-auto grid max-w-4xl items-center gap-10 px-6 py-16 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              Growth
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              The red book, live
            </h2>
            <p className="mt-3 leading-relaxed text-muted">
              Every weight, height and head measurement lands on the nine
              UK-WHO centile curves — the exact ones printed in the red book
              you got from your midwife. Tap any point to see the value and
              centile, and watch the reassuring climb back past birth weight.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-faint">
              &ldquo;Latest weight sits around the 63rd centile for a girl this
              age&rdquo; — in plain words, not clinical jargon.
            </p>
          </div>
          <div className="mx-auto w-[75%] overflow-hidden rounded-[2rem] border border-line bg-surface shadow-xl sm:w-full sm:max-w-[300px]">
            <Image
              src="/screens/who.png"
              alt="UK-WHO weight chart in Beanlo with nine centile curves and the baby's weights plotted"
              width={598}
              height={1300}
              className="h-auto w-full"
            />
          </div>
        </section>

        {/* 3am club */}
        <section className="px-6 py-8">
          <div className="mx-auto grid max-w-4xl items-center gap-10 overflow-hidden rounded-[2.5rem] bg-ink p-8 text-on-ink sm:grid-cols-2 sm:p-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-accent">
                Friends
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                The 3am club
              </h2>
              <p className="mt-3 leading-relaxed opacity-85">
                Add the friends from your antenatal group and see when
                they&rsquo;re up feeding too. A status line, a wave, a private
                message — it turns out 3am is a lot more bearable with company.
              </p>
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold">
                <Lock className="h-3.5 w-3.5" /> Every message is end-to-end
                encrypted
              </p>
            </div>
            <div className="space-y-2.5" aria-hidden>
              <PresenceRow
                initials="AK"
                name="Amara"
                status="feeding now"
                dot="bg-amber-400"
                ring
              />
              <PresenceRow
                initials="SJ"
                name="Sophie"
                status="running on 3 hours of sleep"
                dot="bg-emerald-400"
                ring
              />
              <PresenceRow
                initials="RB"
                name="Rosa"
                status="offline"
                dot="bg-white/30"
              />
              <div className="ml-auto w-fit rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-2xl">
                👋
              </div>
            </div>
          </div>
        </section>

        {/* One-tap logging */}
        <section className="mx-auto grid max-w-4xl items-center gap-10 px-6 py-16 sm:grid-cols-2">
          <div className="order-last sm:order-first" aria-hidden>
            <div className="mx-auto max-w-[300px] rounded-[2rem] border border-line bg-surface p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">Juno</span>
                <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-bold text-accent">
                  D16
                </span>
              </div>
              <p className="mt-4 text-[11px] font-medium text-muted">Last feed</p>
              <p className="text-2xl font-bold tracking-tight">2 hr 14 min ago</p>
              <div className="mt-3 flex gap-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      i < 6 ? "bg-sky-500" : "bg-line"
                    }`}
                  />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <span className="rounded-full bg-accent-soft py-2 text-center text-xs font-bold text-accent">
                  ◉ Left
                </span>
                <span className="rounded-full bg-accent-soft py-2 text-center text-xs font-bold text-accent">
                  ◉ Right
                </span>
                <span className="rounded-full bg-sky-500/15 py-2 text-center text-xs font-bold text-sky-600">
                  💧 Wet
                </span>
                <span className="rounded-full bg-amber-800/15 py-2 text-center text-xs font-bold text-amber-800 dark:text-amber-500">
                  💩 Mixed
                </span>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-faint">
              The home-screen widget — logging without opening the app
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              Speed
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              One hand. One tap. Logged.
            </h2>
            <p className="mt-3 leading-relaxed text-muted">
              You&rsquo;ve got a baby on one arm — logging can&rsquo;t be a
              chore. Tap the widget to log a nappy or start the feed timer
              without opening the app. Map it to the Action Button. Or just say
              it:
            </p>
            <p className="mt-4 rounded-2xl border border-line bg-surface-alt px-5 py-4 text-sm font-medium italic">
              &ldquo;Hey Siri, log a wet nappy in {APP_NAME}&rdquo;
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li className="flex items-start gap-2">
                <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                Feed-due nudges, and a live timer on your lock screen and
                Dynamic Island while you feed
              </li>
              <li className="flex items-start gap-2">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                No signal at 3am? Taps queue and sync when the app next opens —
                nothing is lost
              </li>
            </ul>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-4xl px-6 py-8">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            Everything the first weeks throw at you
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-3xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
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
              {APP_NAME}{" "}is a tracking aid, not a medical device. It doesn&rsquo;t
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

        {/* FAQ */}
        <section className="mx-auto max-w-2xl px-6 py-10">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            Questions, answered
          </h2>
          <div className="mt-7 space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-line bg-surface px-5 py-4 open:shadow-sm"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-muted transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section id="download" className="px-6 pb-20 pt-8">
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2.5rem] px-8 py-14 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 70% 90% at 50% 100%, var(--bg-glow), transparent 70%)",
              }}
            />
            <div className="relative">
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                The night shift is easier with {APP_NAME}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-muted">
                Free to start. Made in the UK, on UK guidance.
              </p>
              <div className="mt-7">
                <AppStoreBadge />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
