"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { planImport, type ImportPlan } from "@/lib/huckleberry";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Upload } from "lucide-react";

const TYPE_LABELS: Record<string, [singular: string, plural: string]> = {
  sleep: ["sleep", "sleeps"],
  feed: ["feed", "feeds"],
  nappy: ["nappy", "nappies"],
  pump: ["pump", "pumps"],
  weight: ["weight", "weights"],
  temperature: ["temperature", "temperatures"],
  medication: ["medicine dose", "medicine doses"],
};

/**
 * Import a Huckleberry "Export tracking data as CSV" file. The file is
 * parsed in the browser (so its zone-less local times are read in the
 * family's own timezone), previewed, and only written after the parent
 * confirms. Every imported row is stamped source='huckleberry' so the whole
 * import can be removed again without touching hand-logged data; re-imports
 * dedupe on (type, time).
 */
export function ImportCard({ babyId }: { babyId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  async function onFile(file: File) {
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      setPlan(planImport(text));
      setFileName(file.name);
    } catch {
      setError("Couldn't read that file.");
    }
  }

  function reset() {
    setPlan(null);
    setFileName(null);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function runImport() {
    if (!plan || plan.drafts.length === 0) return;
    setBusy("import");
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      // Dedupe against everything already logged in the import's time range —
      // paged, because Supabase caps a single select at 1000 rows.
      const times = plan.drafts.map((d) => d.occurred_at).sort();
      const existing = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data, error: qErr } = await supabase
          .from("entries")
          .select("type, occurred_at")
          .eq("baby_id", babyId)
          .gte("occurred_at", times[0])
          .lte("occurred_at", times[times.length - 1])
          .order("occurred_at", { ascending: true })
          .range(from, from + 999);
        if (qErr) throw new Error(qErr.message);
        for (const e of data ?? [])
          existing.add(`${e.type}|${new Date(e.occurred_at).getTime()}`);
        if (!data || data.length < 1000) break;
      }

      const fresh = plan.drafts.filter(
        (d) => !existing.has(`${d.type}|${new Date(d.occurred_at).getTime()}`)
      );
      const duplicates = plan.drafts.length - fresh.length;

      // Insert per entry type: a bulk insert unions the keys of every row in
      // the request (missing keys become explicit nulls), which would trip
      // not-null defaults like med_kind on rows of other types.
      const byType = new Map<string, typeof fresh>();
      for (const d of fresh) {
        const arr = byType.get(d.type) ?? [];
        arr.push(d);
        byType.set(d.type, arr);
      }
      let inserted = 0;
      for (const group of byType.values()) {
        for (let i = 0; i < group.length; i += 200) {
          const chunk = group
            .slice(i, i + 200)
            .map((d) => ({ ...d, baby_id: babyId, created_by: user.id }));
          const { error: insErr } = await supabase
            .from("entries")
            .insert(chunk);
          if (insErr) throw new Error(insErr.message);
          inserted += chunk.length;
          setBusy(`import:${inserted}/${fresh.length}`);
        }
      }

      setResult(
        `Imported ${inserted} entries` +
          (duplicates > 0 ? ` (${duplicates} already existed — skipped)` : "") +
          "."
      );
      setPlan(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(null);
    }
  }

  async function removeImported() {
    setConfirmingRemove(false);
    setBusy("remove");
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: delErr } = await supabase
        .from("entries")
        .delete()
        .eq("baby_id", babyId)
        .eq("source", "huckleberry")
        .select("id");
      if (delErr) throw new Error(delErr.message);
      setResult(`Removed ${data?.length ?? 0} imported entries.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Removal failed.");
    } finally {
      setBusy(null);
    }
  }

  // Preview: mapped counts per Beanlo type.
  const counts = new Map<string, number>();
  for (const d of plan?.drafts ?? [])
    counts.set(d.type, (counts.get(d.type) ?? 0) + 1);

  return (
    <Card className="p-5">
      <CardTitle>Import from Huckleberry</CardTitle>
      <p className="mt-1 text-sm text-muted">
        Moving over? In Huckleberry, tap your child&rsquo;s icon &rarr;
        &ldquo;Export tracking data as CSV&rdquo;, then upload the emailed file
        here. Times are read in this device&rsquo;s timezone. Nothing is saved
        until you confirm.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />

      {!plan && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!!busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> Choose CSV file
          </Button>
          {confirmingRemove ? (
            <span className="flex items-center gap-2 text-xs">
              <button
                type="button"
                disabled={!!busy}
                onClick={removeImported}
                className="rounded-full bg-alert-bg px-3 py-1.5 font-semibold text-alert disabled:opacity-60"
              >
                Remove all imported entries — sure?
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                className="font-medium text-muted underline underline-offset-2 hover:text-ink"
              >
                Keep them
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => setConfirmingRemove(true)}
              className="text-xs font-medium text-muted underline underline-offset-2 hover:text-ink disabled:opacity-60"
            >
              {busy === "remove" ? "Removing…" : "Remove imported entries"}
            </button>
          )}
        </div>
      )}

      {plan && (
        <div className="mt-3 rounded-2xl bg-surface-alt p-4 text-sm">
          <p className="font-medium">{fileName}</p>
          {plan.drafts.length === 0 ? (
            <p className="mt-1 text-muted">
              Nothing importable found in this file.
            </p>
          ) : (
            <ul className="mt-1 space-y-0.5 text-muted">
              {[...counts.entries()].map(([t, n]) => (
                <li key={t}>
                  {n} {TYPE_LABELS[t] ? TYPE_LABELS[t][n === 1 ? 0 : 1] : t}
                </li>
              ))}
            </ul>
          )}
          {Object.keys(plan.skipped).length > 0 && (
            <p className="mt-2 text-xs text-faint">
              No Beanlo equivalent (skipped):{" "}
              {Object.entries(plan.skipped)
                .map(([t, n]) => `${t} ×${n}`)
                .join(", ")}
            </p>
          )}
          {plan.problems.length > 0 && (
            <details className="mt-2 text-xs text-faint">
              <summary>
                {plan.problems.length}{" "}
                {plan.problems.length === 1 ? "row" : "rows"} couldn&rsquo;t be
                read (skipped, not guessed)
              </summary>
              <ul className="mt-1 space-y-0.5">
                {plan.problems.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {plan.drafts.length > 0 && (
              <Button size="sm" disabled={!!busy} onClick={runImport}>
                {busy?.startsWith("import")
                  ? busy.includes(":")
                    ? `Importing… ${busy.split(":")[1]}`
                    : "Importing…"
                  : `Import ${plan.drafts.length} entries`}
              </Button>
            )}
            <Button size="sm" variant="secondary" disabled={!!busy} onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {result && <p className="mt-3 text-sm text-positive">{result}</p>}
      {error && <p className="mt-3 text-sm text-alert">{error}</p>}
    </Card>
  );
}
