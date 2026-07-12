import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getBabyContext } from "@/lib/data";
import { dayOfLife, formatKg } from "@/lib/clinical";
import type { HandoverReport } from "@/lib/types";
import { HandoverClient } from "@/components/export/HandoverClient";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

/** AI handover summary — a printable one-pager for the family's healthcare
 *  professional, written by Bea from the tracked data. */
export default async function HandoverPage() {
  const ctx = await getBabyContext();
  const supabase = await createClient();

  const { data: latest } = await supabase
    .from("handover_reports")
    .select("id, content, created_at")
    .eq("baby_id", ctx.baby.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const report = (latest as HandoverReport | null) ?? null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 text-ink print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>

      <header className="mb-6 border-b border-line pb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {ctx.baby.name} — handover summary
        </h1>
        <p className="mt-1 text-sm text-muted">
          Born{" "}
          {new Date(ctx.baby.birth_at).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {" · "}birth weight {formatKg(ctx.baby.birth_weight_g)}
          {" · "}day {dayOfLife(ctx.baby.birth_at, new Date())} today
        </p>
      </header>

      {ctx.baby.membership_tier !== "advanced" ? (
        <Card className="p-6 text-center">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft">
            <Sparkles className="h-5 w-5 text-accent" />
          </span>
          <p className="font-semibold">Handover summaries are part of Advanced</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            Advanced membership adds Bea, who writes a one-page consult summary
            of {ctx.baby.name}’s data for your midwife or health visitor.
            Upgrades are coming soon.
          </p>
        </Card>
      ) : (
        <HandoverClient
          initial={
            report ? { content: report.content, created_at: report.created_at } : null
          }
          canEdit={ctx.canEdit}
        />
      )}
    </main>
  );
}
