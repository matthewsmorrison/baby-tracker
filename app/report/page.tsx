import Link from "next/link";
import { getBabyContext, getEntries } from "@/lib/data";
import {
  DISCLAIMER,
  dayOfLife,
  formatKg,
  summariseFeeds,
  weightStatus,
} from "@/lib/clinical";
import { feedGaps, formatDuration } from "@/lib/entryDisplay";
import type { Entry } from "@/lib/types";
import { PrintButton } from "@/components/export/PrintButton";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ tz?: string }>;
}) {
  const ctx = await getBabyContext();
  const entries = await getEntries(ctx.baby.id);
  const { tz: tzParam } = await searchParams;
  const tz = tzParam || "UTC";
  const fmtDate = (iso: string | Date, o: Intl.DateTimeFormatOptions) =>
    new Date(iso).toLocaleString("en-GB", { timeZone: tz, ...o });

  // Group by calendar day (in the report's timezone).
  const dayKey = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
  const byDay = new Map<string, Entry[]>();
  for (const e of entries) {
    const k = dayKey(e.occurred_at);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(e);
  }
  const gapByDay = new Map<string, number[]>();
  for (const g of feedGaps(entries)) {
    const k = dayKey(g.at.toISOString());
    if (!gapByDay.has(k)) gapByDay.set(k, []);
    gapByDay.get(k)!.push(g.gapMs);
  }
  const days = [...byDay.keys()].sort().reverse();

  const weights = entries
    .filter((e) => e.type === "weight" && e.weight_g)
    .sort(
      (a, b) =>
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 text-ink print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <PrintButton />
      </div>

      <header className="mb-6 border-b border-line pb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {ctx.baby.name} — tracking summary
        </h1>
        <p className="mt-1 text-sm text-muted">
          Born {fmtDate(ctx.baby.birth_at, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          {" · "}birth weight {formatKg(ctx.baby.birth_weight_g)}
          {" · "}day {dayOfLife(ctx.baby.birth_at, new Date())} today
        </p>
        <p className="text-xs text-faint">
          Generated {fmtDate(new Date(), { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      </header>

      {weights.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold">Weight</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-1.5 pr-3 font-medium">Date</th>
                <th className="py-1.5 pr-3 font-medium">Day</th>
                <th className="py-1.5 pr-3 font-medium">Weight</th>
                <th className="py-1.5 font-medium">vs birth</th>
              </tr>
            </thead>
            <tbody>
              {weights.map((w) => {
                const ws = weightStatus(w.weight_g!, ctx.baby.birth_weight_g);
                return (
                  <tr key={w.id} className="border-b border-line/60">
                    <td className="py-1.5 pr-3">{fmtDate(w.occurred_at, { day: "numeric", month: "short" })}</td>
                    <td className="py-1.5 pr-3">{dayOfLife(ctx.baby.birth_at, w.occurred_at)}</td>
                    <td className="py-1.5 pr-3">{formatKg(w.weight_g!)}</td>
                    <td className="py-1.5">{ws.pct >= 0 ? "+" : ""}{ws.pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold">Daily summary</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-1.5 pr-3 font-medium">Day</th>
              <th className="py-1.5 pr-3 font-medium">Feeds</th>
              <th className="py-1.5 pr-3 font-medium">Nappies</th>
              <th className="py-1.5 font-medium">Sleep</th>
            </tr>
          </thead>
          <tbody>
            {days.map((k) => {
              const es = byDay.get(k)!;
              const f = summariseFeeds(es);
              const dol = dayOfLife(ctx.baby.birth_at, es[0].occurred_at);
              const nap = es.filter((e) => e.type === "nappy");
              const dirty = nap.filter((e) => e.dirty).length;
              const wet = nap.length - dirty;
              const sleepMs = es
                .filter((e) => e.type === "sleep" && e.ended_at)
                .reduce(
                  (s, e) =>
                    s +
                    (new Date(e.ended_at!).getTime() -
                      new Date(e.occurred_at).getTime()),
                  0
                );
              return (
                <tr key={k} className="border-b border-line/60 align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {dol}
                    <span className="text-muted"> · {fmtDate(k + "T12:00:00", { day: "numeric", month: "short" })}</span>
                  </td>
                  <td className="py-1.5 pr-3">
                    {f.sessions} ({f.breastMin}m nursing, {f.expressedMl}ml EBM, {f.formulaMl}ml formula)
                  </td>
                  <td className="py-1.5 pr-3">
                    {wet} wet · {dirty} mixed
                  </td>
                  <td className="py-1.5">{sleepMs ? formatDuration(sleepMs) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <p className="mt-8 border-t border-line pt-3 text-xs text-faint">
        {DISCLAIMER}
      </p>
    </main>
  );
}
