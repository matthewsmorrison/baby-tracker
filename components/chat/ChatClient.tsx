"use client";

import { useEffect, useRef, useState } from "react";
import { DISCLAIMER } from "@/lib/clinical";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowUp, Sparkles } from "lucide-react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "Is his weight on track?",
  "How does this week's formula compare to last week?",
  "What was the longest stretch between feeds last night?",
  "Summarise the last 24 hours",
];

export function ChatClient({ babyName }: { babyName: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);

    const history: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: history,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Something went wrong");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const out = [...m];
          out[out.length - 1] = {
            role: "assistant",
            content: out[out.length - 1].content + chunk,
          };
          return out;
        });
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setMessages((m) => {
          const out = [...m];
          out[out.length - 1] = {
            role: "assistant",
            content:
              out[out.length - 1].content ||
              (e instanceof Error ? e.message : "Something went wrong — try again."),
          };
          return out;
        });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-16rem)] flex-col animate-rise">
      {messages.length === 0 ? (
        <Card className="p-6 text-center">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft">
            <Sparkles className="h-5 w-5 text-accent" />
          </span>
          <p className="font-semibold">Ask about {babyName}’s data</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            Feeds, nappies, weight, patterns — answered from what you’ve
            logged.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="rounded-full border border-line bg-surface-alt px-3.5 py-2 text-xs font-medium text-muted hover:border-ink hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <div className="flex-1 space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-3xl rounded-br-lg bg-ink px-4 py-2.5 text-sm text-white"
                    : "max-w-[92%] rounded-3xl rounded-bl-lg border border-line bg-surface px-4 py-3 text-sm leading-relaxed shadow-card whitespace-pre-wrap"
                }
              >
                {m.content ||
                  (busy && i === messages.length - 1 ? (
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-faint" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-faint [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-faint [animation-delay:240ms]" />
                    </span>
                  ) : (
                    ""
                  ))}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="sticky bottom-24 mt-4 md:bottom-4"
      >
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface p-1.5 pl-4 shadow-card">
          <input
            aria-label={`Ask about ${babyName}'s data`}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
            placeholder={`Ask about ${babyName}…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            aria-label="Send"
            disabled={busy || !input.trim()}
            className="h-9 w-9 !px-0"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </form>

      <p className="mt-3 px-2 text-center text-xs text-faint">{DISCLAIMER}</p>
    </div>
  );
}
