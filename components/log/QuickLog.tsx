"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { entryLabel } from "@/lib/entryDisplay";
import type { Entry } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Mic, MicOff, Sparkles, X } from "lucide-react";

// Minimal typing for the (webkit-prefixed) Web Speech API.
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
  }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

type Draft = Record<string, unknown> & { type: string; occurred_at: string };

/**
 * Natural-language quick log: describe what happened (typed or spoken), Bea
 * parses it into draft entries, the parent confirms before anything is saved.
 * Every confirmed draft is a normal entries row — same as the manual forms.
 */
export function QuickLog({
  babyId,
  onSaved,
}: {
  babyId: string;
  /** Confirm a successful save (snackbar) and close the modal. */
  onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [unclear, setUnclear] = useState<string | null>(null);
  const [busy, setBusy] = useState<"parse" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const [speechAvailable, setSpeechAvailable] = useState(false);

  useEffect(() => {
    // Deferred so the setState happens from a callback, not the effect body.
    const id = window.setTimeout(
      () => setSpeechAvailable(!!getSpeechRecognition()),
      0
    );
    return () => {
      clearTimeout(id);
      recRef.current?.stop();
    };
  }, []);

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const SR = getSpeechRecognition();
    if (!SR) return;
    const rec = new SR();
    rec.lang = navigator.language || "en-GB";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (event) => {
      let heard = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) heard += event.results[i][0].transcript;
      }
      if (heard) setText((t) => (t ? `${t} ${heard.trim()}` : heard.trim()));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function parse() {
    if (!text.trim() || busy) return;
    recRef.current?.stop();
    setBusy("parse");
    setError(null);
    setDrafts(null);
    setUnclear(null);
    try {
      const res = await fetch("/api/quicklog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong");
      setDrafts(data.entries ?? []);
      setUnclear(data.unclear ?? null);
      if ((data.entries ?? []).length === 0 && !data.unclear) {
        setError("Couldn’t find anything to log in that — try rephrasing.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function saveAll() {
    if (!drafts?.length || busy) return;
    setBusy("save");
    setError(null);
    const supabase = createClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const rows = drafts.map((d) => ({
        ...d,
        baby_id: babyId,
        created_by: user!.id,
      }));
      const { error } = await supabase.from("entries").insert(rows);
      if (error) throw new Error(error.message);
      router.refresh();
      setText("");
      setDrafts(null);
      setUnclear(null);
      onSaved(
        drafts.length === 1 ? "Entry saved" : `${drafts.length} entries saved`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const when = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="rounded-2xl border border-line bg-surface-alt p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
        <Sparkles className="h-3.5 w-3.5 text-accent" />
        Quick log — describe it, Bea fills in the forms
      </p>
      <div className="flex items-end gap-2">
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. fed 15 min on the left around 3am, then a wet nappy, asleep in the cot since 4"
          className="min-w-0 flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2 text-base placeholder:text-faint focus:border-ink focus:outline-none"
        />
        {speechAvailable && (
          <button
            type="button"
            aria-label={listening ? "Stop listening" : "Speak instead"}
            aria-pressed={listening}
            onClick={toggleMic}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
              listening
                ? "bg-alert-bg text-alert"
                : "border border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}
      </div>
      <Button
        size="sm"
        className="mt-2 w-full"
        onClick={parse}
        disabled={!!busy || !text.trim()}
      >
        {busy === "parse" ? "Reading…" : "Turn into entries"}
      </Button>

      {error && <p className="mt-2 text-sm text-alert">{error}</p>}

      {drafts && drafts.length > 0 && (
        <div className="mt-3 space-y-2">
          {drafts.map((d, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {entryLabel(d as unknown as Entry)}
                </p>
                <p className="text-xs text-faint">
                  {when(d.occurred_at)}
                  {typeof d.note === "string" && d.note
                    ? ` · “${d.note}”`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                aria-label="Discard this entry"
                onClick={() =>
                  setDrafts((ds) => ds!.filter((_, j) => j !== i))
                }
                className="shrink-0 rounded-full p-1.5 text-faint hover:bg-alert-bg hover:text-alert"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {unclear && (
            <p className="text-xs text-muted">
              Bea wasn’t sure about: {unclear} — add it with the forms below.
            </p>
          )}
          <Button
            size="sm"
            className="w-full"
            onClick={saveAll}
            disabled={!!busy}
          >
            {busy === "save"
              ? "Saving…"
              : drafts.length === 1
                ? "Save entry"
                : `Save ${drafts.length} entries`}
          </Button>
        </div>
      )}
      {drafts && drafts.length === 0 && unclear && (
        <p className="mt-2 text-xs text-muted">Bea wasn’t sure about: {unclear}</p>
      )}
    </div>
  );
}
