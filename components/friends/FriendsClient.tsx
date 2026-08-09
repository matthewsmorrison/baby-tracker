"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendship,
  sendDirectMessage,
} from "@/lib/friendActions";
import { getOrCreateKeyPair, deriveSharedKey, encryptMessage } from "@/lib/e2ee";
import { effectivePresence, PRESENCE_LABEL } from "@/lib/presence";
import type { FriendsData } from "@/lib/friends";
import type { PresenceStatus, Profile } from "@/lib/types";
import { PresenceDot } from "./PresenceDot";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Check, Hand, MessageCircle, UserPlus } from "lucide-react";

const PRESENCE_POLL_MS = 30_000;

function displayName(p: Profile) {
  return p.full_name ?? p.email ?? "A beanlo user";
}

/** MSN-style status line, saved straight to your own profile row. */
function StatusEditor({
  me,
  supabase,
}: {
  me: Profile;
  supabase: SupabaseClient;
}) {
  const [text, setText] = useState(me.status_text ?? "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const t = text.trim().slice(0, 80);
    setBusy(true);
    await supabase
      .from("profiles")
      .update({ status_text: t || null })
      .eq("id", me.id);
    setBusy(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="mt-3 flex items-center gap-2"
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={80}
        placeholder="Set a status — e.g. “running on 3 hours of sleep”"
        // text-base (16px) so iOS doesn't zoom in on focus.
        className="h-10 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-base outline-none transition focus:border-ink"
      />
      <Button type="submit" size="sm" variant="secondary" disabled={busy}>
        {saved ? <Check className="h-4 w-4 text-positive" /> : "Set"}
      </Button>
    </form>
  );
}

export function FriendsClient({
  data,
  me,
}: {
  data: FriendsData;
  me: Profile | null;
}) {
  const supabase = useState(() => createClient())[0];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [waving, setWaving] = useState<string | null>(null);
  const [waved, setWaved] = useState<Set<string>>(new Set());
  // Live presence, refreshed by polling; keyed by friend user id. Ticking
  // `now` also demotes stale heartbeats to offline between polls.
  const [live, setLive] = useState(
    new Map<string, Pick<Profile, "presence_status" | "presence_at">>()
  );
  const [now, setNow] = useState(() => Date.now());

  const friendIds = data.friends.map((f) => f.profile.id);
  const friendIdsKey = friendIds.join(",");

  useEffect(() => {
    if (!friendIds.length) return;
    const poll = async () => {
      const { data: rows } = await supabase
        .from("profiles")
        .select("id, presence_status, presence_at")
        .in("id", friendIds);
      setNow(Date.now());
      setLive(
        new Map(
          (rows ?? []).map((p) => [
            p.id as string,
            {
              presence_status: p.presence_status as PresenceStatus,
              presence_at: p.presence_at as string | null,
            },
          ])
        )
      );
    };
    const first = window.setTimeout(() => void poll(), 0);
    const i = setInterval(poll, PRESENCE_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(i);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendIdsKey, supabase]);

  const statusOf = (p: Profile): PresenceStatus => {
    const fresh = live.get(p.id) ?? p;
    return effectivePresence(fresh.presence_status, fresh.presence_at, now);
  };

  /** One-tap 👋 — an E2EE message like any other, just pre-written. */
  const wave = async (p: Profile) => {
    if (!p.public_key || waving) return;
    setWaving(p.id);
    setError(null);
    try {
      const kp = await getOrCreateKeyPair();
      const key = await deriveSharedKey(
        kp.privateJwk,
        JSON.parse(p.public_key) as JsonWebKey
      );
      const ct = await encryptMessage(key, "👋");
      const res = await sendDirectMessage(p.id, ct, "wave");
      if (res.error) setError(res.error);
      else setWaved((s) => new Set(s).add(p.id));
    } finally {
      setWaving(null);
    }
  };

  return (
    <div className="space-y-6 animate-rise">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Friends</h1>
        <p className="mt-1 text-sm text-muted">
          Green when they have beanlo open — and{" "}
          <span className="font-medium text-positive">feeding now</span> while
          a feed timer runs. Company for the night shift.
        </p>
        {me && <StatusEditor me={me} supabase={supabase} />}
      </div>

      {error && (
        <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">
          {error}
        </p>
      )}

      {data.incoming.length > 0 && (
        <Card className="p-5">
          <CardTitle className="mb-3">Friend requests</CardTitle>
          <ul className="divide-y divide-line">
            {data.incoming.map(({ friendship, profile }) => (
              <li key={friendship.id} className="flex items-center gap-3 py-3">
                <Avatar name={displayName(profile)} src={profile.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{displayName(profile)}</p>
                  <p className="truncate text-xs text-muted">{profile.email}</p>
                </div>
                <form
                  action={async () => {
                    const res = await acceptFriendRequest(friendship.id);
                    if (res?.error) setError(res.error);
                  }}
                >
                  <Button size="sm" type="submit">
                    Accept
                  </Button>
                </form>
                <form
                  action={async () => {
                    const res = await removeFriendship(friendship.id);
                    if (res?.error) setError(res.error);
                  }}
                >
                  <Button size="sm" variant="ghost" type="submit">
                    Decline
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-5">
        <CardTitle className="mb-3">Your friends</CardTitle>
        {data.friends.length === 0 ? (
          <p className="text-sm text-muted">
            No friends yet — add one below. You’ll see a green dot whenever
            they have beanlo open.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {data.friends.map(({ friendship, profile, unread }) => {
              const status = statusOf(profile);
              return (
                <li key={friendship.id} className="flex items-center gap-2 py-3">
                  <Link
                    href={`/friends/${profile.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 transition hover:opacity-80"
                  >
                    <Avatar name={displayName(profile)} src={profile.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {displayName(profile)}
                      </p>
                      <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                        <PresenceDot status={status} />
                        {PRESENCE_LABEL[status]}
                        {profile.status_text && (
                          <span className="truncate text-faint">
                            · {profile.status_text}
                          </span>
                        )}
                      </p>
                    </div>
                    {unread > 0 && (
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-white">
                        {unread}
                      </span>
                    )}
                    <MessageCircle className="h-4 w-4 shrink-0 text-faint" />
                  </Link>
                  {profile.public_key && (
                    <button
                      type="button"
                      disabled={waving === profile.id}
                      onClick={() => void wave(profile)}
                      aria-label={`Wave at ${displayName(profile)}`}
                      title="Send a wave"
                      className={`shrink-0 rounded-full border px-2.5 py-2 text-sm transition ${
                        waved.has(profile.id)
                          ? "border-transparent bg-positive-bg text-positive"
                          : "border-line bg-surface text-muted hover:border-ink hover:text-ink"
                      }`}
                    >
                      {waved.has(profile.id) ? (
                        "👋 sent"
                      ) : (
                        <Hand className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <CardTitle className="mb-1">Add a friend</CardTitle>
        <p className="mb-3 text-xs text-muted">
          They need a beanlo account — they’ll get a request to accept here.
        </p>
        <form
          action={async (fd) => {
            setBusy(true);
            setError(null);
            setSent(false);
            const res = await sendFriendRequest(fd);
            setBusy(false);
            if (res?.error) setError(res.error);
            else setSent(true);
          }}
          className="flex items-end gap-2"
        >
          <div className="min-w-0 flex-1">
            <Label htmlFor="friend-email">Friend’s email</Label>
            <Input
              id="friend-email"
              name="email"
              type="email"
              required
              placeholder="friend@example.com"
            />
          </div>
          <Button type="submit" disabled={busy}>
            <UserPlus className="h-4 w-4" strokeWidth={2.2} />
            Add
          </Button>
        </form>
        {sent && !error && (
          <p className="mt-3 rounded-2xl bg-positive-bg px-4 py-3 text-sm text-positive">
            Request sent.
          </p>
        )}
      </Card>

      {data.outgoing.length > 0 && (
        <Card className="p-5">
          <CardTitle className="mb-3">Sent requests</CardTitle>
          <ul className="divide-y divide-line">
            {data.outgoing.map(({ friendship, profile }) => (
              <li key={friendship.id} className="flex items-center gap-3 py-3">
                <Avatar name={displayName(profile)} src={profile.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{displayName(profile)}</p>
                  <p className="text-xs text-muted">waiting for them to accept</p>
                </div>
                <form
                  action={async () => {
                    const res = await removeFriendship(friendship.id);
                    if (res?.error) setError(res.error);
                  }}
                >
                  <Button size="sm" variant="ghost" type="submit">
                    Cancel
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.blocked.length > 0 && (
        <Card className="p-5">
          <CardTitle className="mb-1">Blocked</CardTitle>
          <p className="mb-3 text-xs text-muted">
            They can’t message you or send new requests, and they can’t see
            your presence. They weren’t told.
          </p>
          <ul className="divide-y divide-line">
            {data.blocked.map(({ friendship, profile }) => (
              <li key={friendship.id} className="flex items-center gap-3 py-3">
                <Avatar name={displayName(profile)} src={profile.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{displayName(profile)}</p>
                </div>
                <form
                  action={async () => {
                    const res = await removeFriendship(friendship.id);
                    if (res?.error) setError(res.error);
                  }}
                >
                  <Button size="sm" variant="ghost" type="submit">
                    Unblock
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
