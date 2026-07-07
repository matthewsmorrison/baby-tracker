"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "./supabase/server";
import { createServiceClient } from "./supabase/service";
import { ACTIVE_BABY_COOKIE } from "./data";
import type { MemberRole } from "./types";

export async function createBaby(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const birthAt = String(formData.get("birth_at") ?? "");
  const weight = parseInt(String(formData.get("birth_weight_g") ?? ""), 10);

  if (!name || !birthAt || !Number.isFinite(weight) || weight <= 0) {
    throw new Error("Please fill in name, birth date/time and birth weight.");
  }

  // No .select() on this insert: the RETURNING row is checked against the
  // select policy (is_baby_member) before the owner-membership trigger has
  // run, which fails RLS. Generate the id here instead.
  const babyId = crypto.randomUUID();
  const { error } = await supabase.from("babies").insert({
    id: babyId,
    name,
    birth_at: new Date(birthAt).toISOString(),
    birth_weight_g: weight,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BABY_COOKIE, babyId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  redirect("/today");
}

/**
 * Accept an invite by token. Uses the service role: the invitee cannot insert
 * their own membership under RLS, so we verify token + email server-side.
 */
export async function acceptInvite(token: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const service = createServiceClient();
  const { data: invite } = await service
    .from("baby_invites")
    .select("*")
    .eq("token", token)
    .single();

  if (!invite || invite.status !== "pending") {
    throw new Error("This invite is no longer valid.");
  }
  if (invite.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    throw new Error(
      `This invite was sent to ${invite.email}. Sign in with that email to accept it.`
    );
  }

  const { error: memberError } = await service
    .from("baby_members")
    .upsert(
      { baby_id: invite.baby_id, user_id: user.id, role: invite.role },
      { onConflict: "baby_id,user_id", ignoreDuplicates: true }
    );
  if (memberError) throw new Error(memberError.message);

  await service
    .from("baby_invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BABY_COOKIE, invite.baby_id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  redirect("/today");
}

export async function setActiveBaby(babyId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BABY_COOKIE, babyId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// --- Profile/admin actions ------------------------------------------------

export async function createInvite(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const babyId = String(formData.get("baby_id"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role")) as MemberRole;

  if (!email || !["caregiver", "viewer"].includes(role)) {
    throw new Error("Enter an email and pick a role.");
  }

  // RLS: only the baby's owner can insert invites.
  const { error } = await supabase
    .from("baby_invites")
    .insert({ baby_id: babyId, email, role, invited_by: user.id });
  if (error) throw new Error(error.message);

  revalidatePath("/profile");
}

export async function revokeInvite(inviteId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("baby_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId);
  if (error) throw new Error(error.message);
  revalidatePath("/profile");
}

export async function removeMember(memberId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("baby_members")
    .delete()
    .eq("id", memberId);
  if (error) throw new Error(error.message);
  revalidatePath("/profile");
}

export async function leaveBaby(memberId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("baby_members")
    .delete()
    .eq("id", memberId);
  if (error) throw new Error(error.message);
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_BABY_COOKIE);
  redirect("/onboarding");
}

export async function updateBirthDetails(formData: FormData) {
  const supabase = await createClient();
  const babyId = String(formData.get("baby_id"));
  const name = String(formData.get("name") ?? "").trim();
  const birthAt = String(formData.get("birth_at") ?? "");
  const weight = parseInt(String(formData.get("birth_weight_g") ?? ""), 10);
  const nappyBase = parseInt(
    String(formData.get("nappy_base_weight_g") ?? ""),
    10
  );

  if (!name || !birthAt || !Number.isFinite(weight) || weight <= 0) {
    throw new Error("Please fill in name, birth date/time and birth weight.");
  }

  // RLS: only the owner can update the baby.
  const { error } = await supabase
    .from("babies")
    .update({
      name,
      birth_at: new Date(birthAt).toISOString(),
      birth_weight_g: weight,
      nappy_base_weight_g:
        Number.isFinite(nappyBase) && nappyBase > 0 ? nappyBase : null,
    })
    .eq("id", babyId);
  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}
