"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendship,
} from "@/lib/friendActions";
import { effectivePresence, PRESENCE_LABEL } from "@/lib/presence";
import type { FriendsData } from "@/lib/friends";
import type { PresenceStatus, Profile } from "@/lib/types";
import { PresenceDot } from "./PresenceDot";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { MessageCircle, UserPlus } from "lucide-react";

const PRESENCE_POLL_MS = 30_000;

function displayName(p: Profile) {
  return p.full_name ?? p.email ?? "A beanlo user";
}

export function FriendsClient({ data }: { data: FriendsData }) {
  const supabase = useState(() => createClient())[0];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
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
    void poll();
    const i = setInterval(poll, PRESENCE_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(i);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendIdsKey, supabase]);

  const statusOf = (p: Profile): PresenceStatus => {
    const fresh = live.get(p.id) ?? p;
    return effectivePresence(fresh.presence_status, fresh.presence_at, now);
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
      </div>

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
                <form action={() => acceptFriendRequest(friendship.id)}>
                  <Button size="sm" type="submit">
                    Accept
                  </Button>
                </form>
                <form action={() => removeFriendship(friendship.id)}>
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
                <li key={friendship.id}>
                  <Link
                    href={`/friends/${profile.id}`}
                    className="flex items-center gap-3 py-3 transition hover:opacity-80"
                  >
                    <Avatar name={displayName(profile)} src={profile.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {displayName(profile)}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-muted">
                        <PresenceDot status={status} />
                        {PRESENCE_LABEL[status]}
                      </p>
                    </div>
                    {unread > 0 && (
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-white">
                        {unread}
                      </span>
                    )}
                    <MessageCircle className="h-4 w-4 text-faint" />
                  </Link>
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
            try {
              await sendFriendRequest(fd);
              setSent(true);
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Something went wrong";
              // Next.js redirect() throws — let it through.
              if (msg.includes("NEXT_REDIRECT")) throw e;
              setError(msg);
            } finally {
              setBusy(false);
            }
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
        {error && (
          <p className="mt-3 rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">
            {error}
          </p>
        )}
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
                <form action={() => removeFriendship(friendship.id)}>
                  <Button size="sm" variant="ghost" type="submit">
                    Cancel
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
