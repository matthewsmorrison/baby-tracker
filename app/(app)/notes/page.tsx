import { getBabyContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { BabyNote, Profile } from "@/lib/types";
import { NotesClient, type TagMember } from "@/components/notes/NotesClient";

export default async function NotesPage() {
  const ctx = await getBabyContext();
  const supabase = await createClient();

  // Notes and the taggable-members list are independent — fetch in parallel
  // (this page used to be four serial round trips).
  const [{ data: notes }, { data: members }] = await Promise.all([
    supabase
      .from("baby_notes")
      .select("*")
      .eq("baby_id", ctx.baby.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("baby_members")
      .select("user_id, role")
      .eq("baby_id", ctx.baby.id),
  ]);

  // Photo URLs need the notes, profiles need the members — but not each other.
  const photoPaths = (notes ?? []).flatMap((n) => n.photo_paths ?? []);
  const userIds = (members ?? []).map((m) => m.user_id);
  const [signed, { data: profiles }] = await Promise.all([
    photoPaths.length > 0
      ? supabase.storage.from("nappy-photos").createSignedUrls(photoPaths, 600)
      : Promise.resolve({ data: null }),
    supabase.from("profiles").select("*").in("id", userIds),
  ]);

  // Short-TTL signed URLs for any attached note photos (private bucket).
  const photoUrls: Record<string, string> = {};
  for (const item of signed.data ?? []) {
    if (item.signedUrl && item.path) photoUrls[item.path] = item.signedUrl;
  }
  const profileMap = new Map((profiles ?? []).map((p: Profile) => [p.id, p]));

  const tagMembers: TagMember[] = (members ?? []).map((m) => {
    const p = profileMap.get(m.user_id);
    return {
      userId: m.user_id,
      name: p?.full_name || p?.email || "Carer",
      role: m.role,
      isSelf: m.user_id === ctx.userId,
    };
  });

  return (
    <NotesClient
      babyId={ctx.baby.id}
      canEdit={ctx.canEdit}
      advanced={ctx.baby.membership_tier === "advanced"}
      currentUserId={ctx.userId}
      notes={(notes ?? []) as BabyNote[]}
      members={tagMembers}
      photoUrls={photoUrls}
    />
  );
}
