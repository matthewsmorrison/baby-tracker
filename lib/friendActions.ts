"use server";

import { redirect } from "next/navigation";
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

/** Send a friend request to an existing beanlo user by email. */
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
      error: "No beanlo account uses that email — ask them to sign up first.",
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
  ciphertext: string
): Promise<{ message?: DirectMessage; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!ciphertext?.trim()) return { error: "Empty message." };

  const { data, error } = await supabase
    .from("messages")
    .insert({ sender: user.id, recipient: recipientId, body: ciphertext })
    .select()
    .single();
  if (error) return { error: error.message };

  // Best-effort push. E2EE means the server only relays ciphertext, so the
  // notification says who — never what. The tag collapses a burst of
  // messages from the same sender into one notification.
  try {
    const { data: me } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();
    await sendToUsers([recipientId], {
      title: `${me?.full_name ?? me?.email ?? "A friend"} messaged you`,
      body: "Open beanlo to read it.",
      url: `/friends/${user.id}`,
      tag: `dm-${user.id}`,
    });
  } catch {
    // The message is stored; a failed push shouldn't fail the send.
  }
  return { message: data as DirectMessage };
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
