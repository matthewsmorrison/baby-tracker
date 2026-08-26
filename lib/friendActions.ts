"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { createServiceClient } from "./supabase/service";
import { sendToUsers } from "./push";
import type { DirectMessage } from "./types";

/** Server actions must RETURN failures rather than throw them: Next.js
 *  redacts thrown error messages in production ("An error occurred in the
 *  Server Components render…"), so a thrown "no account with that email"
 *  reaches the user as noise. */
export interface ActionResult {
  error?: string;
}

/** Send a friend request to an existing Beanlo user by email. */
export async function sendFriendRequest(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter your friend’s email." };
  if (email === (user.email ?? "").toLowerCase()) {
    return { error: "That’s your own email." };
  }

  // Service role: profiles are only readable by co-members and friends, so
  // the lookup has to bypass RLS. Only the id leaves this call. Escape the
  // ilike wildcards so "%@%" can't match an arbitrary account.
  const { data: target, error: lookupError } = await createServiceClient()
    .from("profiles")
    .select("id")
    .ilike("email", email.replace(/[\\%_]/g, "\\$&"))
    .maybeSingle();
  if (lookupError) return { error: lookupError.message };
  if (!target) {
    return {
      error: "No Beanlo account uses that email — ask them to sign up first.",
    };
  }

  const { error } = await supabase
    .from("friendships")
    .insert({ requester: user.id, addressee: target.id });
  if (error) {
    // 23505 = the pair unique index: a request already exists either way round.
    return {
      error:
        error.code === "23505"
          ? "You already have a friendship or pending request with them."
          : error.message,
    };
  }
  revalidatePath("/friends");
  return {};
}

export async function acceptFriendRequest(
  friendshipId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", friendshipId);
  if (error) return { error: error.message };
  revalidatePath("/friends");
  return {};
}

/** Store an (already-encrypted) message and ping the recipient. RLS rejects
 *  the insert unless the two users are accepted friends. */
export async function sendDirectMessage(
  recipientId: string,
  ciphertext: string,
  kind: "text" | "wave" = "text"
): Promise<{ message?: DirectMessage; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!ciphertext?.trim()) return { error: "Empty message." };
  if (kind !== "text" && kind !== "wave") return { error: "Unknown message kind." };

  const { data, error } = await supabase
    .from("messages")
    .insert({ sender: user.id, recipient: recipientId, body: ciphertext, kind })
    .select()
    .single();
  if (error) return { error: error.message };

  // Best-effort push, sent AFTER the response so it never delays the send
  // (web-push round-trips were the "laggy return key"). E2EE means the
  // server only relays ciphertext, so the notification says who — never
  // what. The tag collapses a burst from the same sender into one alert.
  const senderId = user.id;
  after(async () => {
    try {
      const { data: me } = await createServiceClient()
        .from("profiles")
        .select("full_name, email")
        .eq("id", senderId)
        .single();
      const name = me?.full_name ?? me?.email ?? "A friend";
      await sendToUsers([recipientId], {
        title:
          kind === "wave" ? `${name} waved at you 👋` : `${name} messaged you`,
        body:
          kind === "wave" ? "They're up too. Wave back?" : "Open Beanlo to read it.",
        url: `/friends/${senderId}`,
        tag: `dm-${senderId}`,
      });
    } catch {
      // The message is stored; a failed push shouldn't fail anything.
    }
  });
  return { message: data as DirectMessage };
}

/** Block: flips the friendship row so they can't message or re-request, and
 *  clears their unread so no ghost badge lingers. Unblock = removeFriendship
 *  (the delete policy only lets the blocker delete a blocked row). */
export async function blockFriend(
  friendshipId: string,
  otherUserId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("friendships")
    .update({ status: "blocked", blocked_by: user.id })
    .eq("id", friendshipId);
  if (error) return { error: error.message };

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString(), receipt_suppressed: true })
    .eq("sender", otherUserId)
    .eq("recipient", user.id)
    .is("read_at", null);

  revalidatePath("/friends");
  return {};
}

/** Decline an incoming request, cancel an outgoing one, or unfriend. */
export async function removeFriendship(
  friendshipId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId);
  if (error) return { error: error.message };
  revalidatePath("/friends");
  return {};
}
