"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { createServiceClient } from "./supabase/service";
import { sendToUsers } from "./push";
import type { DirectMessage } from "./types";

/** Send a friend request to an existing beanlo user by email. */
export async function sendFriendRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) throw new Error("Enter your friend’s email.");
  if (email === (user.email ?? "").toLowerCase()) {
    throw new Error("That’s your own email.");
  }

  // Service role: profiles are only readable by co-members and friends, so
  // the lookup has to bypass RLS. Only the id leaves this call. Escape the
  // ilike wildcards so "%@%" can't match an arbitrary account.
  const { data: target } = await createServiceClient()
    .from("profiles")
    .select("id")
    .ilike("email", email.replace(/[\\%_]/g, "\\$&"))
    .maybeSingle();
  if (!target) {
    throw new Error(
      "No beanlo account uses that email — ask them to sign up first."
    );
  }

  const { error } = await supabase
    .from("friendships")
    .insert({ requester: user.id, addressee: target.id });
  if (error) {
    // 23505 = the pair unique index: a request already exists either way round.
    throw new Error(
      error.code === "23505"
        ? "You already have a friendship or pending request with them."
        : error.message
    );
  }
  revalidatePath("/friends");
}

export async function acceptFriendRequest(friendshipId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", friendshipId);
  if (error) throw new Error(error.message);
  revalidatePath("/friends");
}

/** Store an (already-encrypted) message and ping the recipient. RLS rejects
 *  the insert unless the two users are accepted friends. */
export async function sendDirectMessage(
  recipientId: string,
  ciphertext: string
): Promise<DirectMessage> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!ciphertext?.trim()) throw new Error("Empty message.");

  const { data, error } = await supabase
    .from("messages")
    .insert({ sender: user.id, recipient: recipientId, body: ciphertext })
    .select()
    .single();
  if (error) throw new Error(error.message);

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
  return data as DirectMessage;
}

/** Decline an incoming request, cancel an outgoing one, or unfriend. */
export async function removeFriendship(friendshipId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId);
  if (error) throw new Error(error.message);
  revalidatePath("/friends");
}
