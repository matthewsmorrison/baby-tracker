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

/** Update a single baby setting from its own row in Profile. */
export async function updateBabySetting(formData: FormData) {
  const supabase = await createClient();
  const babyId = String(formData.get("baby_id"));
  const field = String(formData.get("field"));
  const raw = String(formData.get("value") ?? "").trim();

  const updates: Record<string, unknown> = {};
  switch (field) {
    case "name":
      if (!raw) throw new Error("The name can’t be empty.");
      updates.name = raw;
      break;
    case "birth_at":
      if (!raw) throw new Error("Pick the date and time of birth.");
      updates.birth_at = new Date(raw).toISOString();
      break;
    case "birth_weight_g": {
      const v = parseInt(raw, 10);
      if (!(v >= 500 && v <= 7000))
        throw new Error("Enter the birth weight in grams (e.g. 3800).");
      updates.birth_weight_g = v;
      break;
    }
    case "nappy_base_weight_g": {
      if (!raw) {
        updates.nappy_base_weight_g = null; // cleared — inference off
        break;
      }
      const v = parseInt(raw, 10);
      if (!(v > 0 && v <= 200))
        throw new Error("Enter the dry nappy weight in grams (e.g. 28).");
      updates.nappy_base_weight_g = v;
      break;
    }
    case "feed_interval_h": {
      if (!raw) {
        updates.feed_interval_min = null; // cleared — next-feed card hidden
        break;
      }
      const v = parseFloat(raw);
      if (!(v > 0 && v <= 12))
        throw new Error("Enter the interval in hours (e.g. 3 or 2.5).");
      updates.feed_interval_min = Math.round(v * 60);
      break;
    }
    default:
      throw new Error("Unknown setting.");
  }

  // RLS: only the owner can update the baby.
  const { error } = await supabase.from("babies").update(updates).eq("id", babyId);
  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}

// --- Consultation notes ---------------------------------------------------

export async function createNote(
  babyId: string,
  body: string,
  taggedUserIds: string[],
  kind: "question" | "note" = "question"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const text = body.trim();
  if (!text) throw new Error("Write a question or note first.");
  const { data, error } = await supabase
    .from("baby_notes")
    .insert({
      baby_id: babyId,
      kind,
      body: text,
      tagged_user_ids: taggedUserIds ?? [],
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/notes");
  return data.id as string;
}

/** Persist the photo paths attached to a note (uploaded client-side). */
export async function setNotePhotos(noteId: string, paths: string[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("baby_notes")
    .update({ photo_paths: paths.length ? paths : null })
    .eq("id", noteId);
  if (error) throw new Error(error.message);
  revalidatePath("/notes");
}

export async function editNote(
  noteId: string,
  body: string,
  taggedUserIds: string[]
) {
  const supabase = await createClient();
  const text = body.trim();
  if (!text) throw new Error("The note can’t be empty.");
  const { error } = await supabase
    .from("baby_notes")
    .update({ body: text, tagged_user_ids: taggedUserIds ?? [] })
    .eq("id", noteId);
  if (error) throw new Error(error.message);
  revalidatePath("/notes");
}

/** Record (or, with empty text, clear) the answer to a note. */
export async function setNoteAnswer(noteId: string, answer: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const text = answer.trim();
  const { error } = await supabase
    .from("baby_notes")
    .update(
      text
        ? {
            answer: text,
            answered_at: new Date().toISOString(),
            answered_by: user.id,
          }
        : { answer: null, answered_at: null, answered_by: null }
    )
    .eq("id", noteId);
  if (error) throw new Error(error.message);
  revalidatePath("/notes");
}

export async function deleteNote(noteId: string) {
  const supabase = await createClient();
  // Remove any attached photos from storage first (RLS lets editors delete).
  const { data: note } = await supabase
    .from("baby_notes")
    .select("photo_paths")
    .eq("id", noteId)
    .single();
  const paths = (note?.photo_paths ?? []) as string[];
  if (paths.length) {
    await supabase.storage.from("nappy-photos").remove(paths);
  }
  const { error } = await supabase.from("baby_notes").delete().eq("id", noteId);
  if (error) throw new Error(error.message);
  revalidatePath("/notes");
}

// --- Deletion (GDPR) ------------------------------------------------------

/** Remove every stored photo under a baby's storage folder. */
async function removeBabyPhotos(
  service: ReturnType<typeof createServiceClient>,
  babyId: string
) {
  const { data: files } = await service.storage
    .from("nappy-photos")
    .list(babyId, { limit: 1000 });
  if (files && files.length) {
    await service.storage
      .from("nappy-photos")
      .remove(files.map((f) => `${babyId}/${f.name}`));
  }
}

/** Delete a baby and all its data. Owner only (RLS enforces the row delete);
 *  storage objects are cleaned up with the service role. */
export async function deleteBaby(babyId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Confirm ownership before touching storage.
  const { data: owner } = await supabase.rpc("is_baby_owner", { bid: babyId });
  if (!owner) throw new Error("Only the owner can delete this baby.");

  await removeBabyPhotos(createServiceClient(), babyId);

  // Cascades entries, members, invites, notes, alert log via FKs.
  const { error } = await supabase.from("babies").delete().eq("id", babyId);
  if (error) throw new Error(error.message);

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_BABY_COOKIE);
  redirect("/today");
}

/** Delete the signed-in user's account: any babies they own (with photos),
 *  their memberships, subscriptions, profile, and the auth user itself. */
export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();

  // Babies this user owns → delete outright (photos + cascade).
  const { data: owned } = await service
    .from("baby_members")
    .select("baby_id")
    .eq("user_id", user.id)
    .eq("role", "owner");
  for (const m of owned ?? []) {
    await removeBabyPhotos(service, m.baby_id);
    await service.from("babies").delete().eq("id", m.baby_id);
  }

  // Deleting the auth user cascades their remaining memberships, push
  // subscriptions and profile row.
  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) throw new Error(error.message);

  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_BABY_COOKIE);
  redirect("/login");
}


const TRACK_TYPES = [
  "nappy",
  "feed",
  "sleep",
  "weight",
  "pump",
  "carer_sleep",
  "medication",
] as const;

/** Set which categories a baby tracks (owner only via RLS). At least one. */
export async function updateTrackedTypes(babyId: string, types: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const valid = TRACK_TYPES.filter((t) => types.includes(t));
  if (valid.length === 0) throw new Error("Keep at least one category on.");
  const { error } = await supabase
    .from("babies")
    .update({ tracked_types: valid })
    .eq("id", babyId);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
