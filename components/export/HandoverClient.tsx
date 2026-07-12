"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PrintButton } from "./PrintButton";
import { RefreshCw, Sparkles } from "lucide-react";

interface Report {
  content: string;
  created_at: string;
}

/**
 * The AI handover summary: renders the latest stored report and lets a carer
 * generate a fresh one from the current data (stored server-side, so it's
 * there to print or revisit without regenerating).
 */
export function HandoverClient({
  initial,
  canEdit,
}: {
  initial: Report | null;
  canEdit: boolean;
}) {
  const [report, setReport] = useState<Report | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/handover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong");
      setReport({ content: data.content, created_at: data.created_at });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
        {canEdit && (
          <Button size="sm" onClick={generate} disabled={busy}>
            {report ? (
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {busy
              ? "Writing the summary…"
              : report
                ? "Regenerate from current data"
                : "Generate summary"}
          </Button>
        )}
        {report && <PrintButton />}
      </div>

      {error && (
        <p className="mb-4 rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert print:hidden">
          {error}
        </p>
      )}

      {report ? (
        <>
          <p className="mb-4 text-xs text-faint">
            Written by Bea from the tracked data on{" "}
            {new Date(report.created_at).toLocaleString(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            . Not medical advice — for discussion with your healthcare
            professional.
          </p>
          <div className="chat-md text-sm leading-relaxed">
            <Markdown remarkPlugins={[remarkGfm]}>{report.content}</Markdown>
          </div>
        </>
      ) : (
        <Card className="p-6 text-center print:hidden">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft">
            <Sparkles className="h-5 w-5 text-accent" />
          </span>
          <p className="font-semibold">No handover summary yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Bea writes a one-page summary of the tracked data — feeding
            pattern, weight trajectory, nappy output and your open questions —
            ready to hand to your midwife, health visitor or lactation
            consultant.
          </p>
        </Card>
      )}
    </>
  );
}
