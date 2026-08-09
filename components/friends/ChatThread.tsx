"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { PresenceDot } from "./PresenceDot";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, LockKeyhole, SendHorizonal } from "lucide-react";

const POLL_MS = 4_000;

export function ChatThread({
  me,
  friend: initialFriend,
  initialMessages,
}: {
  me: string;
  friend: Profile;
  initialMessages: DirectMessage[];
}) {
  const supabase = useState(() => createClient())[0];
  const [friend, setFriend] = useState(initialFriend);
  const [messages, setMessages] = useState(initialMessages);
  const [plain, setPlain] = useState(new Map<string, string | null>());
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
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
        await supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .eq("recipient", me)
          .eq("sender", friend.id)
          .is("read_at", null);
      }
    }
  }, [supabase, me, friend.id]);

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

  const send = async () => {
    const text = draft.trim();
    if (!text || !sharedKey || sending) return;
    setSending(true);
    setSendFailed(false);
    try {
      const body = await encryptMessage(sharedKey, text);
      // Server action rather than a direct insert so the recipient gets a
      // push notification (contents stay encrypted — the push only names you).
      const row = await sendDirectMessage(friend.id, body);
      setPlain((prev) => new Map(prev).set(row.id, text));
      setMessages((prev) => [...prev, row]);
      setDraft("");
    } catch {
      setSendFailed(true); // draft is kept — they can retry
    } finally {
      setSending(false);
    }
  };

  const status: PresenceStatus = effectivePresence(
    friend.presence_status,
    friend.presence_at,
    now
  );
  const name = friend.full_name ?? friend.email ?? "Friend";

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
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <PresenceDot status={status} />
            {PRESENCE_LABEL[status]}
          </p>
        </div>
        <span
          className="flex items-center gap-1 text-[10px] text-faint"
          title="Messages are encrypted on your device — the server only stores ciphertext"
        >
          <LockKeyhole className="h-3 w-3" />
          end-to-end encrypted
        </span>
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
          return (
            <div key={m.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-3xl px-4 py-2.5 text-sm ${
                  own
                    ? "rounded-br-lg bg-ink text-on-ink"
                    : "rounded-bl-lg bg-surface-alt"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">
                  {text === null ? (
                    <span className={own ? "text-on-ink/70" : "text-faint"}>
                      🔒 Can’t decrypt on this device
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
            void send();
          }}
          className="flex items-center gap-2 border-t border-line pt-3"
        >
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
          Waiting for {name.split(" ")[0]} to open beanlo once so your devices
          can exchange encryption keys.
        </p>
      )}
    </div>
  );
}
