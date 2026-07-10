"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";
import { DISCLAIMER } from "@/lib/clinical";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Portal } from "@/components/ui/Portal";
import {
  ArrowUp,
  MessageSquarePlus,
  MessagesSquare,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string | null;
  updated_at: string;
}

const STARTERS = [
  "Is his weight on track?",
  "How does this week's formula compare to last week?",
  "What was the longest stretch between feeds last night?",
  "Summarise the last 24 hours",
];

/** Compact "when" label for the conversation list. */
function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function ChatClient({
  babyId,
  babyName,
}: {
  babyId: string;
  babyName: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loadingConvo, setLoadingConvo] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const supabase = useRef(createClient()).current;

  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from("chat_conversations")
      .select("id, title, updated_at")
      .eq("baby_id", babyId)
      .order("updated_at", { ascending: false });
    setConversations((data as Conversation[]) ?? []);
  }, [supabase, babyId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function newChat() {
    abortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setInput("");
    setListOpen(false);
  }

  async function openConversation(id: string) {
    if (id === conversationId) {
      setListOpen(false);
      return;
    }
    abortRef.current?.abort();
    setListOpen(false);
    setLoadingConvo(true);
    setConversationId(id);
    setMessages([]);
    const { data } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    setMessages((data as Msg[]) ?? []);
    setLoadingConvo(false);
  }

  async function deleteConversation(id: string) {
    setConfirmDeleteId(null);
    await supabase.from("chat_conversations").delete().eq("id", id);
    setConversations((c) => c.filter((x) => x.id !== id));
    if (id === conversationId) newChat();
  }

  /** Persist a message; failures (e.g. read-only viewers) don't break the chat. */
  async function saveMessage(convoId: string, role: Msg["role"], content: string) {
    try {
      await supabase
        .from("chat_messages")
        .insert({ conversation_id: convoId, role, content });
    } catch {
      /* best-effort */
    }
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);

    // Start (or continue) a saved conversation.
    let convoId = conversationId;
    if (!convoId) {
      const title = q.length > 70 ? q.slice(0, 70).trimEnd() + "…" : q;
      const { data } = await supabase
        .from("chat_conversations")
        .insert({ baby_id: babyId, title })
        .select("id, title, updated_at")
        .single();
      if (data) {
        convoId = (data as Conversation).id;
        setConversationId(convoId);
        setConversations((c) => [data as Conversation, ...c]);
      }
    }
    if (convoId) saveMessage(convoId, "user", q);

    const history: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;
    let answer = "";
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
        answer += chunk;
        setMessages((m) => {
          const out = [...m];
          out[out.length - 1] = {
            role: "assistant",
            content: out[out.length - 1].content + chunk,
          };
          return out;
        });
      }
      if (convoId && answer.trim()) {
        await saveMessage(convoId, "assistant", answer);
        // Bump the conversation to the top of the list.
        await supabase
          .from("chat_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", convoId);
        loadConversations();
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        const msg =
          answer ||
          (e instanceof Error ? e.message : "Something went wrong — try again.");
        setMessages((m) => {
          const out = [...m];
          out[out.length - 1] = { role: "assistant", content: msg };
          return out;
        });
        // Save whatever streamed before the error so it isn't lost.
        if (convoId && answer.trim()) saveMessage(convoId, "assistant", answer);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  const activeTitle =
    conversations.find((c) => c.id === conversationId)?.title ?? null;
  const showBar = conversations.length > 0 || messages.length > 0;

  return (
    <div className="flex min-h-[calc(100dvh-16rem)] flex-col animate-rise">
      {showBar && (
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setListOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:border-ink hover:text-ink"
          >
            <MessagesSquare className="h-3.5 w-3.5" />
            Chats
            {conversations.length > 0 && (
              <span className="text-faint">({conversations.length})</span>
            )}
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-medium text-muted">
            {activeTitle ?? "New chat"}
          </p>
          <button
            type="button"
            onClick={newChat}
            aria-label="New chat"
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:border-ink hover:text-ink"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            New
          </button>
        </div>
      )}

      {loadingConvo ? (
        <div className="flex flex-1 items-center justify-center text-sm text-faint">
          Loading conversation…
        </div>
      ) : messages.length === 0 ? (
        <Card className="p-6 text-center">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft">
            <Sparkles className="h-5 w-5 text-accent" />
          </span>
          <p className="font-semibold">Ask Bea about {babyName}</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            Bea answers from what you’ve logged — feeds, nappies, weight,
            patterns. Chats are saved and shared with everyone caring for{" "}
            {babyName}.
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
                    ? "max-w-[85%] rounded-3xl rounded-br-lg bg-ink px-4 py-2.5 text-sm text-on-ink"
                    : "chat-md max-w-[92%] rounded-3xl rounded-bl-lg border border-line bg-surface px-4 py-3 text-sm leading-relaxed shadow-card"
                }
              >
                {m.role === "assistant" && m.content ? (
                  <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
                ) : null}
                {m.role === "assistant" ? null : m.content}
                {!m.content &&
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
            aria-label={`Ask Bea about ${babyName}'s data`}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
            placeholder={`Ask Bea about ${babyName}…`}
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

      {listOpen && (
        <Portal>
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
            onClick={() => setListOpen(false)}
          >
            <div
              role="dialog"
              aria-label="Saved conversations"
              className="max-h-[75vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-card sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">Saved chats</p>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setListOpen(false)}
                  className="rounded-full p-1.5 text-muted hover:bg-surface-alt hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={newChat}
                className="mb-2 flex w-full items-center gap-2 rounded-2xl border border-line bg-surface-alt px-4 py-3 text-sm font-medium text-ink hover:border-ink"
              >
                <MessageSquarePlus className="h-4 w-4" />
                New chat
              </button>

              {conversations.length === 0 ? (
                <p className="py-6 text-center text-sm text-faint">
                  No saved chats yet.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {conversations.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 py-1">
                      <button
                        type="button"
                        onClick={() => openConversation(c.id)}
                        className={`min-w-0 flex-1 rounded-xl px-2 py-2 text-left hover:bg-surface-alt ${
                          c.id === conversationId ? "bg-surface-alt" : ""
                        }`}
                      >
                        <p className="truncate text-sm font-medium">
                          {c.title ?? "Untitled chat"}
                        </p>
                        <p className="text-xs text-faint">{relTime(c.updated_at)}</p>
                      </button>
                      {confirmDeleteId === c.id ? (
                        <span className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => deleteConversation(c.id)}
                            className="rounded-full bg-alert-bg px-3 py-1.5 text-xs font-semibold text-alert"
                          >
                            Delete?
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-full px-2 py-1.5 text-xs font-medium text-muted"
                          >
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          aria-label="Delete conversation"
                          onClick={() => setConfirmDeleteId(c.id)}
                          className="rounded-full p-2 text-faint hover:bg-alert-bg hover:text-alert"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
