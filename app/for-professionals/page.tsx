import Link from "next/link";
import {
  Eye,
  Flame,
  LineChart,
  Link2,
  Stethoscope,
  UserPlus,
} from "lucide-react";
import { Footer } from "@/components/marketing/Footer";
import { APP_NAME } from "@/lib/legal";

export const metadata = {
  title: `${APP_NAME} for professionals`,
  description:
    "Lactation consultants, midwives, health visitors and NCT teachers: get a shareable page and referral code, and see your clients' feeding, nappy and weight logs (read-only) before a consult.",
};

const POINTS = [
  {
    icon: Link2,
    title: "Your own page & referral code",
    body: "A shareable profile at beanlo.com/pro/you and a code to give clients — sign-ups via your link are attributed to you.",
  },
  {
    icon: Eye,
    title: "See the log before a consult",
    body: "Families can add you as a read-only carer, so you walk in already knowing the feeds, nappies and weight — no reconstructing it from memory.",
  },
  {
    icon: LineChart,
    title: "Day-by-day, NHS & WHO-based",
    body: "Nappy quotas, expected stool colours and sex-specific WHO weight centiles — the same guidance you'd point families to.",
  },
];

export default function ForProfessionals() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft">
            <Flame className="h-5 w-5 text-accent" strokeWidth={2.2} />
          </span>
          <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
        </Link>
        <Link
          href="/"
          className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-ink"
        >
          For parents
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
            <Stethoscope className="h-6 w-6 text-accent" />
          </span>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {APP_NAME} for professionals
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            For lactation consultants, midwives, health visitors, NCT teachers
            and doulas. Give families a gentle tracker, and see their log
            (read-only) so your support is better informed.
          </p>
          <Link
            href="/for-professionals/start"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-base font-semibold text-on-ink hover:opacity-90"
          >
            <UserPlus className="h-4 w-4" />
            Sign up as a professional
          </Link>
          <p className="mt-3 text-xs text-faint">Free, with Google.</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {POINTS.map((p) => (
            <div key={p.title} className="rounded-3xl border border-line bg-surface p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <p.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{p.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted">
          Already registered?{" "}
          <Link href="/login" className="font-medium underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </main>

      <Footer />
    </div>
  );
}
