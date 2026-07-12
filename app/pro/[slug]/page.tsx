import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Professional } from "@/lib/types";
import { Footer } from "@/components/marketing/Footer";
import { APP_NAME } from "@/lib/legal";
import { Baby, Flame, Globe, HeartHandshake, MapPin } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("professionals")
    .select("name, title")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return { title: `${APP_NAME}` };
  return {
    title: `${data.name} · recommends ${APP_NAME}`,
    description: `${data.name}, ${data.title}, recommends ${APP_NAME} — a free newborn tracker. Start tracking and share your log with ${data.name}.`,
  };
}

export default async function ProPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("professionals")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) notFound();
  const pro = data as Professional;

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
          href="/login"
          className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-ink"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-6">
        <div className="rounded-3xl border border-line bg-surface p-6 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-lg font-bold text-accent">
            {pro.name.charAt(0)}
          </span>
          <h1 className="text-xl font-bold tracking-tight">{pro.name}</h1>
          <p className="mt-0.5 text-sm font-medium text-accent">{pro.title}</p>
          {pro.location && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted">
              <MapPin className="h-3.5 w-3.5" />
              {pro.location}
            </p>
          )}
          {pro.bio && (
            <p className="mt-4 text-left text-sm leading-relaxed text-muted">
              {pro.bio}
            </p>
          )}
          {pro.website && (
            <a
              href={pro.website}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted underline underline-offset-4 hover:text-ink"
            >
              <Globe className="h-3.5 w-3.5" />
              Visit website
            </a>
          )}
        </div>

        <div className="mt-4 rounded-3xl border border-line bg-surface-alt p-6 text-center">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface">
            <HeartHandshake className="h-5 w-5 text-accent" />
          </span>
          <h2 className="font-bold">
            {pro.name.split(" ")[0]} recommends {APP_NAME}
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            A free newborn tracker for nappies, feeds, weight and sleep — with
            what’s normal for each day from NHS &amp; WHO guidance. Start below
            and you can invite {pro.name.split(" ")[0]} to view your log.
          </p>
          <Link
            href={`/pro/${pro.slug}/start`}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-base font-semibold text-on-ink hover:opacity-90"
          >
            <Baby className="h-4 w-4" />
            Start tracking free
          </Link>
          <p className="mt-3 text-xs text-faint">
            Referral code: <span className="font-semibold">{pro.invite_code}</span>
          </p>
        </div>

        <p className="mt-4 px-2 text-center text-xs text-faint">
          {APP_NAME} is a tracking aid, not medical advice.
        </p>
      </main>

      <Footer />
    </div>
  );
}
