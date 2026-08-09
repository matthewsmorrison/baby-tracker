"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { sendDirectMessage } from "@/lib/friendActions";
import {
  getOrCreateKeyPair,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
} from "@/lib/e2ee";
import { effectivePresence, PRESENCE_LABEL } from "@/lib/presence";
import type { DirectMessage, PresenceStatus, Profile } from "@/lib/types";
import { useRouter } from "next/navigation";
import { blockFriend } from "@/lib/friendActions";
import { PresenceDot } from "./PresenceDot";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Ban, Hand, LockKeyhole, SendHorizonal } from "lucide-react";

const POLL_MS = 4_000;

export function ChatThread({
  me,
  friend: initialFriend,
  initialMessages,
  friendshipId,
  myReceiptsOn,
}: {
  me: string;
  friend: Profile;
  initialMessages: DirectMessage[];
  friendshipId: string;
  myReceiptsOn: boolean;
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
      setMessages(msgs as DirectMessage[]);
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
  }, [messages.length]);

  const send = async (text: string, kind: "text" | "wave" = "text") => {
    if (!text || !sharedKey || sending) return;
    setSending(true);
    setSendFailed(false);
    try {
      const body = await encryptMessage(sharedKey, text);
      // Server action rather than a direct insert so the recipient gets a
      // push notification (contents stay encrypted — the push only names you).
      const res = await sendDirectMessage(friend.id, body, kind);
      if (res.error || !res.message) throw new Error(res.error);
      const row = res.message;
      setPlain((prev) => new Map(prev).set(row.id, text));
      setMessages((prev) => [...prev, row]);
      if (kind === "text") setDraft("");
    } catch {
      setSendFailed(true); // draft is kept — they can retry
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
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              {seen && (
                <p className="mt-0.5 text-right text-[10px] text-faint">Seen</p>
              )}
            </div>
          );
        })}
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
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${name.split(" ")[0]}…`}
            maxLength={2000}
            className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-sm outline-none transition focus:border-ink"
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
