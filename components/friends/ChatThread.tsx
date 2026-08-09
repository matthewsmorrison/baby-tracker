"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sendDirectMessage } from "@/lib/friendActions";
import {
  getOrCreateKeyPair,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
} from "@/lib/e2ee";
import { effectivePresence, PRESENCE_LABEL } from "@/lib/presence";
import { formatTime } from "@/lib/dates";
import type { DirectMessage, PresenceStatus, Profile } from "@/lib/types";
import { useRouter } from "next/navigation";
import { blockFriend } from "@/lib/friendActions";
import { PresenceDot } from "./PresenceDot";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { OPEN_LOG_EVENT } from "@/components/log/LogModal";
import {
  ArrowLeft,
  Ban,
  Hand,
  LockKeyhole,
  Plus,
  SendHorizonal,
} from "lucide-react";

// Realtime delivers messages instantly; the poll is a slow safety net that
// also refreshes presence/status and the friend's key.
const POLL_MS = 15_000;
// How long the three-dots bubble lingers after the last typing event.
const TYPING_LINGER_MS = 3_000;
// Throttle for outgoing typing broadcasts.
const TYPING_SEND_MS = 1_500;

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-3xl rounded-bl-lg bg-surface-alt px-4 py-3">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-faint"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ChatThread({
  me,
  friend: initialFriend,
  initialMessages,
  friendshipId,
  myReceiptsOn,
  canLog,
  babyId,
}: {
  me: string;
  friend: Profile;
  initialMessages: DirectMessage[];
  friendshipId: string;
  myReceiptsOn: boolean;
  canLog: boolean;
  babyId: string;
}) {
  const supabase = useState(() => createClient())[0];
  const [friend, setFriend] = useState(initialFriend);
  const [messages, setMessages] = useState(initialMessages);
  const [plain, setPlain] = useState(new Map<string, string | null>());
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blocking, startBlock] = useTransition();
  const [friendTyping, setFriendTyping] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingHideRef = useRef<number | undefined>(undefined);
  const typingSentAtRef = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  const bottomRef = useRef<HTMLDivElement>(null);
  const derivedFromRef = useRef<string | null>(null);

  // Key setup: make sure this browser has a keypair and it's published, then
  // derive the pair key once the friend has published theirs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const kp = await getOrCreateKeyPair();
      const myPublic = JSON.stringify(kp.publicJwk);
      const { data: mine } = await supabase
        .from("profiles")
        .select("public_key")
        .eq("id", me)
        .single();
      if (cancelled) return;
      if (mine && mine.public_key !== myPublic) {
        await supabase
          .from("profiles")
          .update({ public_key: myPublic })
          .eq("id", me);
      }
      if (friend.public_key && derivedFromRef.current !== friend.public_key) {
        derivedFromRef.current = friend.public_key;
        const key = await deriveSharedKey(
          kp.privateJwk,
          JSON.parse(friend.public_key) as JsonWebKey
        );
        if (!cancelled) setSharedKey(key);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, me, friend.public_key]);

  // Poll: friend's presence/key, new messages, and mark incoming as read.
  const poll = useCallback(async () => {
    const [{ data: p }, { data: msgs }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", friend.id).single(),
      supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender.eq.${me},recipient.eq.${friend.id}),and(sender.eq.${friend.id},recipient.eq.${me})`
        )
        .order("created_at", { ascending: true })
        .limit(500),
    ]);
    setNow(Date.now());
    if (p) setFriend(p as Profile);
    if (msgs) {
      // Keep any optimistic temp bubbles a concurrent send has in flight.
      setMessages((prev) => [
        ...(msgs as DirectMessage[]),
        ...prev.filter((m) => m.id.startsWith("temp-")),
      ]);
      const unread = (msgs as DirectMessage[]).some(
        (m) => m.recipient === me && !m.read_at
      );
      if (unread) {
        // receipt_suppressed: unread still clears, but with read receipts
        // off the sender's UI won't show "Seen".
        await supabase
          .from("messages")
          .update({
            read_at: new Date().toISOString(),
            receipt_suppressed: !myReceiptsOn,
          })
          .eq("recipient", me)
          .eq("sender", friend.id)
          .is("read_at", null);
      }
    }
  }, [supabase, me, friend.id, myReceiptsOn]);

  useEffect(() => {
    const first = window.setTimeout(() => void poll(), 0);
    const i = setInterval(poll, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(i);
    };
  }, [poll]);

  // Realtime: incoming messages appear instantly; updates to my own messages
  // (read receipts) stream back live. RLS filters what we can receive.
  useEffect(() => {
    const channel = supabase
      .channel(`dm-${me}-${friend.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient=eq.${me}`,
        },
        (payload) => {
          const row = payload.new as DirectMessage;
          if (row.sender !== friend.id) return;
          setFriendTyping(false);
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row]
          );
          void supabase
            .from("messages")
            .update({
              read_at: new Date().toISOString(),
              receipt_suppressed: !myReceiptsOn,
            })
            .eq("id", row.id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `sender=eq.${me}`,
        },
        (payload) => {
          const row = payload.new as DirectMessage;
          setMessages((prev) =>
            prev.map((m) => (m.id === row.id ? row : m))
          );
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, me, friend.id, myReceiptsOn]);

  // Typing indicator: an ephemeral broadcast channel scoped to this pair —
  // nothing is stored, events just fade after a few seconds.
  useEffect(() => {
    const pairKey = [me, friend.id].sort().join(":");
    const channel = supabase
      .channel(`typing:${pairKey}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if ((payload as { user?: string })?.user !== friend.id) return;
        setFriendTyping(true);
        window.clearTimeout(typingHideRef.current);
        typingHideRef.current = window.setTimeout(
          () => setFriendTyping(false),
          TYPING_LINGER_MS
        );
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      window.clearTimeout(typingHideRef.current);
      typingChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [supabase, me, friend.id]);

  // Watch the feed timer so the header's log button can show its pulse and
  // jump straight to the running feed (the floating pill is hidden in chat).
  useEffect(() => {
    if (!canLog) return;
    const key = `hearth-feed-timer-${babyId}`;
    const read = () => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return setTimerRunning(false);
        const t = JSON.parse(raw) as { side: string | null; startTs: number | null };
        setTimerRunning(Boolean(t.side && t.startTs));
      } catch {
        setTimerRunning(false);
      }
    };
    const first = window.setTimeout(read, 0);
    const i = setInterval(read, 5_000);
    window.addEventListener("storage", read);
    return () => {
      clearTimeout(first);
      clearInterval(i);
      window.removeEventListener("storage", read);
    };
  }, [babyId, canLog]);

  const notifyTyping = () => {
    const nowMs = Date.now();
    if (nowMs - typingSentAtRef.current < TYPING_SEND_MS) return;
    typingSentAtRef.current = nowMs;
    void typingChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { user: me },
    });
  };

  // Decrypt anything we haven't decrypted yet.
  useEffect(() => {
    if (!sharedKey) return;
    const missing = messages.filter((m) => !plain.has(m.id));
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        missing.map(
          async (m) => [m.id, await decryptMessage(sharedKey, m.body)] as const
        )
      );
      if (cancelled) return;
      setPlain((prev) => {
        const next = new Map(prev);
        for (const [id, text] of entries) next.set(id, text);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, sharedKey, plain]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, friendTyping]);

  const send = async (text: string, kind: "text" | "wave" = "text") => {
    if (!text || !sharedKey || sending) return;
    setSending(true);
    setSendFailed(false);
    // Optimistic: the bubble appears and the box clears instantly; the
    // server round-trip swaps the temp row for the real one.
    const tempId = `temp-${crypto.randomUUID()}`;
    const temp: DirectMessage = {
      id: tempId,
      sender: me,
      recipient: friend.id,
      body: "",
      kind,
      created_at: new Date().toISOString(),
      read_at: null,
      receipt_suppressed: false,
    };
    setPlain((prev) => new Map(prev).set(tempId, text));
    setMessages((prev) => [...prev, temp]);
    if (kind === "text") setDraft("");
    try {
      const body = await encryptMessage(sharedKey, text);
      // Server action rather than a direct insert so the recipient gets a
      // push notification (contents stay encrypted — the push only names you).
      const res = await sendDirectMessage(friend.id, body, kind);
      if (res.error || !res.message) throw new Error(res.error);
      const row = res.message;
      setPlain((prev) => new Map(prev).set(row.id, text));
      setMessages((prev) => prev.map((m) => (m.id === tempId ? row : m)));
    } catch {
      // Roll back: drop the bubble, restore the draft for a retry.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      if (kind === "text") setDraft(text);
      setSendFailed(true);
    } finally {
      setSending(false);
    }
  };

  const block = () => {
    startBlock(async () => {
      const res = await blockFriend(friendshipId, friend.id);
      if (!res?.error) router.push("/friends");
    });
  };

  const status: PresenceStatus = effectivePresence(
    friend.presence_status,
    friend.presence_at,
    now
  );
  const name = friend.full_name ?? friend.email ?? "Friend";
  const lastOwnId = [...messages].reverse().find((m) => m.sender === me)?.id;

  return (
    <div className="flex h-[calc(100dvh-11.5rem)] flex-col animate-rise md:h-[calc(100dvh-7rem)]">
      <div className="flex items-center gap-3 border-b border-line pb-3">
        <Link
          href="/friends"
          className="rounded-full p-2 text-muted transition hover:bg-surface-alt hover:text-ink"
          aria-label="Back to friends"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
        </Link>
        <Avatar name={name} src={friend.avatar_url} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted">
            <PresenceDot status={status} />
            {PRESENCE_LABEL[status]}
            {friend.status_text && (
              <span className="truncate text-faint">· {friend.status_text}</span>
            )}
          </p>
        </div>
        <span
          className="hidden items-center gap-1 text-[10px] text-faint sm:flex"
          title={`Messages are private — we can't read them. Only you and ${name} can.`}
        >
          <LockKeyhole className="h-3 w-3" />
          private — we can’t read these
        </span>
        {canLog && (
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent(OPEN_LOG_EVENT, {
                  detail: timerRunning ? { tab: "feed" } : {},
                })
              )
            }
            aria-label="Log an entry"
            title={
              timerRunning
                ? "Feed timer running — tap to return to it"
                : "Log an entry"
            }
            className="relative shrink-0 rounded-full p-2 text-faint transition hover:bg-surface-alt hover:text-ink"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            {timerRunning && (
              <span className="absolute right-1 top-1 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
            )}
          </button>
        )}
        {confirmBlock ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={blocking}
              onClick={block}
              className="rounded-full bg-alert-bg px-3 py-1.5 text-xs font-semibold text-alert"
            >
              {blocking ? "Blocking…" : "Block?"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmBlock(false)}
              className="rounded-full px-2 py-1.5 text-xs text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmBlock(true)}
            aria-label={`Block ${name}`}
            title="Block — they can't message you or see your presence"
            className="shrink-0 rounded-full p-2 text-faint transition hover:bg-alert-bg hover:text-alert"
          >
            <Ban className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto py-4">
        {messages.length === 0 && (
          <p className="pt-8 text-center text-sm text-muted">
            Say hi — especially if you’re both up at 3am.
          </p>
        )}
        {messages.map((m) => {
          const own = m.sender === me;
          const text = plain.get(m.id);
          const seen =
            own &&
            m.id === lastOwnId &&
            !!m.read_at &&
            !m.receipt_suppressed &&
            myReceiptsOn;
          return (
            <div key={m.id}>
              <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-3xl px-4 py-2.5 ${
                    m.kind === "wave" ? "text-2xl" : "text-sm"
                  } ${
                    own
                      ? "rounded-br-lg bg-ink text-on-ink"
                      : "rounded-bl-lg bg-surface-alt"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {text === null ? (
                      <span
                        className={`text-sm ${own ? "text-on-ink/70" : "text-faint"}`}
                      >
                        🔒 Only readable on the device it was sent to
                      </span>
                    ) : (
                      (text ?? "…")
                    )}
                  </p>
                  <p
                    className={`mt-0.5 text-right text-[10px] ${
                      own ? "text-on-ink/60" : "text-faint"
                    }`}
                  >
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
              {seen && (
                <p className="mt-0.5 text-right text-[10px] text-faint">Seen</p>
              )}
            </div>
          );
        })}
        {friendTyping && <TypingDots />}
        <div ref={bottomRef} />
      </div>

      {sendFailed && (
        <p className="pb-1 text-center text-xs text-alert">
          Couldn’t send — check your connection and try again.
        </p>
      )}
      {friend.public_key ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft.trim());
          }}
          className="flex items-center gap-2 border-t border-line pt-3"
        >
          <button
            type="button"
            disabled={!sharedKey || sending}
            onClick={() => void send("👋", "wave")}
            aria-label="Send a wave"
            title="Wave — you're both up"
            className="shrink-0 rounded-full border border-line bg-surface p-2.5 text-muted transition hover:border-ink hover:text-ink disabled:opacity-50"
          >
            <Hand className="h-4 w-4" strokeWidth={2.2} />
          </button>
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (e.target.value) notifyTyping();
            }}
            placeholder={`Message ${name.split(" ")[0]}…`}
            maxLength={2000}
            // text-base (16px): anything smaller makes iOS zoom the whole
            // page in when the input is focused.
            className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-base outline-none transition focus:border-ink"
          />
          <Button
            type="submit"
            disabled={!draft.trim() || !sharedKey || sending}
            aria-label="Send"
            className="px-4"
          >
            <SendHorizonal className="h-4 w-4" strokeWidth={2.2} />
          </Button>
        </form>
      ) : (
        <p className="border-t border-line pt-3 text-center text-xs text-muted">
          You’ll be able to message {name.split(" ")[0]} once they’ve opened
          beanlo.
        </p>
      )}
    </div>
  );
}
