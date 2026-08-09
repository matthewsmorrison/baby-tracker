import { createClient } from "./supabase/server";
import type { Friendship, Profile } from "./types";

export interface FriendsData {
  friends: Array<{ friendship: Friendship; profile: Profile; unread: number }>;
  incoming: Array<{ friendship: Friendship; profile: Profile }>;
  outgoing: Array<{ friendship: Friendship; profile: Profile }>;
  /** People this user has blocked (the other side never sees these rows). */
  blocked: Array<{ friendship: Friendship; profile: Profile }>;
}

/** Everything the Friends page needs: accepted friends (with unread message
 *  counts), incoming requests and outgoing pending requests. */
export async function getFriendsData(userId: string): Promise<FriendsData> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("friendships")
    .select("*")
    .or(`requester.eq.${userId},addressee.eq.${userId}`)
    .order("created_at", { ascending: false });
  const friendships = (rows ?? []) as Friendship[];

  const otherIds = friendships.map((f) =>
    f.requester === userId ? f.addressee : f.requester
  );
  const profileMap = new Map<string, Profile>();
  if (otherIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", otherIds);
    for (const p of (profiles ?? []) as Profile[]) profileMap.set(p.id, p);
  }

  // Unread counts per sender, for the badge on each friend row.
  const { data: unreadRows } = await supabase
    .from("messages")
    .select("sender")
    .eq("recipient", userId)
    .is("read_at", null);
  const unread = new Map<string, number>();
  for (const m of unreadRows ?? []) {
    unread.set(m.sender, (unread.get(m.sender) ?? 0) + 1);
  }

  const out: FriendsData = { friends: [], incoming: [], outgoing: [], blocked: [] };
  for (const f of friendships) {
    const otherId = f.requester === userId ? f.addressee : f.requester;
    const profile = profileMap.get(otherId);
    if (!profile) continue;
    if (f.status === "blocked") {
      // Only the blocker sees the row surfaced (to unblock); if someone
      // blocked *you*, the connection silently disappears.
      if (f.blocked_by === userId) out.blocked.push({ friendship: f, profile });
    } else if (f.status === "accepted") {
      out.friends.push({
        friendship: f,
        profile,
        unread: unread.get(otherId) ?? 0,
      });
    } else if (f.addressee === userId) {
      out.incoming.push({ friendship: f, profile });
    } else {
      out.outgoing.push({ friendship: f, profile });
    }
  }
  return out;
}
